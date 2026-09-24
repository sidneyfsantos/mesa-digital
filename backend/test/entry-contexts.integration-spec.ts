import { randomUUID } from 'node:crypto';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import { DatabaseService } from '../src/database/database.service.js';
import { EntryCredentialRepository } from '../src/database/repositories/entry-credential.repository.js';
import { EntryModeRepository } from '../src/database/repositories/entry-mode.repository.js';
import { ServicePointRepository } from '../src/database/repositories/service-point.repository.js';
import { entryCredentials, servicePoints, tenantEntryModes } from '../src/database/schema/index.js';
import { EntryCredentialService } from '../src/entry-contexts/entry-credential.service.js';
import { EntryModeService } from '../src/entry-contexts/entry-mode.service.js';
import { QrTokenService } from '../src/entry-contexts/qr-token.service.js';
import { ServicePointService } from '../src/entry-contexts/service-point.service.js';
describe('Entry contexts and secure QR isolation', () => {
  const admin = new Pool({ connectionString: process.env.DATABASE_ADMIN_URL });
  const database = new DatabaseService(); const pointRepository = new ServicePointRepository(); const credentialRepository = new EntryCredentialRepository(); const modeRepository = new EntryModeRepository();
  const modes = new EntryModeService(database, modeRepository); const points = new ServicePointService(database, pointRepository, modeRepository); const credentials = new EntryCredentialService(database, credentialRepository, new QrTokenService());
  const tenantA = randomUUID(); const tenantB = randomUUID(); let tableA: string; let tabA: string; let tableB: string;
  beforeAll(async () => {
    await admin.query(`insert into tenants (id, name, slug) values ($1, 'Entry Tenant A', $2), ($3, 'Entry Tenant B', $4)`, [tenantA, `entry-a-${tenantA}`, tenantB, `entry-b-${tenantB}`]);
    await modes.replace(tenantA, { enabledServicePointKinds: ['FIXED_TABLE', 'MOBILE_TAB'] }); await modes.replace(tenantB, { enabledServicePointKinds: ['FIXED_TABLE'] });
    tableA = (await points.create(tenantA, { kind: 'FIXED_TABLE', label: 'Mesa A', code: 'A-1' })).id;
    tabA = (await points.create(tenantA, { kind: 'MOBILE_TAB', label: 'Comanda A', code: 'C-1' })).id;
    tableB = (await points.create(tenantB, { kind: 'FIXED_TABLE', label: 'Mesa B', code: 'B-1' })).id;
  });
  afterAll(async () => {
    await admin.query('delete from entry_credentials where tenant_id = any($1)', [[tenantA, tenantB]]); await admin.query('delete from service_points where tenant_id = any($1)', [[tenantA, tenantB]]); await admin.query('delete from tenant_entry_modes where tenant_id = any($1)', [[tenantA, tenantB]]); await admin.query('delete from tenants where id = any($1)', [[tenantA, tenantB]]); await database.onApplicationShutdown(); await admin.end();
  });
  it('configures tables, mobile tabs, or both per tenant', async () => {
    expect(await modes.get(tenantA)).toEqual({ enabledServicePointKinds: ['FIXED_TABLE', 'MOBILE_TAB'] });
    await expect(points.create(tenantB, { kind: 'MOBILE_TAB', label: 'Disabled' })).rejects.toBeInstanceOf(ConflictException);
  });
  it('keeps both service point kinds tenant-isolated', async () => {
    expect((await points.list(tenantA)).map(({ id }) => id)).toEqual(expect.arrayContaining([tableA, tabA]));
    expect((await points.list(tenantA)).map(({ id }) => id)).not.toContain(tableB);
    expect(await database.withTenantContext(tenantA, (tx) => pointRepository.update(tx, tenantB, tableB, { label: 'Leaked' }))).toEqual([]);
  });
  it('returns no tenant-scoped entry data without context', async () => {
    const result = await database.transaction(async (tx) => ({ points: await tx.select().from(servicePoints), credentials: await tx.select().from(entryCredentials), modes: await tx.select().from(tenantEntryModes) }));
    expect(result).toEqual({ points: [], credentials: [], modes: [] });
  });
  it.each([['FIXED_TABLE', () => tableA, 'Mesa A'], ['MOBILE_TAB', () => tabA, 'Comanda A']] as const)('stores only a QR hash and resolves minimal %s context', async (kind, id, label) => {
    const issued = await credentials.issue(tenantA, id()); const stored = await admin.query<{ token_hash: string }>('select token_hash from entry_credentials where id = $1', [issued.credentialId]);
    expect(stored.rows[0].token_hash).toMatch(/^[0-9a-f]{64}$/); expect(stored.rows[0].token_hash).not.toBe(issued.token);
    await expect(credentials.resolvePublic(issued.token)).resolves.toEqual({ establishment: { name: 'Entry Tenant A' }, entry: { kind: 'QR', servicePoint: { kind, label } } });
  });
  it('revokes immediately and regenerates with one active credential', async () => {
    await credentials.revoke(tenantA, tableA); const old = await credentials.issue(tenantA, tableA); const fresh = await credentials.regenerate(tenantA, tableA);
    await expect(credentials.resolvePublic(old.token)).rejects.toBeInstanceOf(NotFoundException); await expect(credentials.resolvePublic(fresh.token)).resolves.toBeDefined();
    const count = await admin.query<{ count: string }>('select count(*) from entry_credentials where tenant_id = $1 and service_point_id = $2 and revoked_at is null', [tenantA, tableA]); expect(count.rows[0].count).toBe('1');
  });
  it('rejects a cross-tenant credential association', async () => {
    await expect(database.withTenantContext(tenantA, (tx) => credentialRepository.create(tx, tenantA, tableB, new QrTokenService().generate().hash))).rejects.toMatchObject({ cause: { code: '23503' } });
  });
  it('serializes concurrent regeneration to one active credential', async () => {
    const concurrent = (await points.create(tenantA, { kind: 'MOBILE_TAB', label: 'Concurrent' })).id; await credentials.issue(tenantA, concurrent);
    const rotated = await Promise.all([credentials.regenerate(tenantA, concurrent), credentials.regenerate(tenantA, concurrent)]);
    const results = await Promise.all(rotated.map(({ token }) => credentials.resolvePublic(token).then(() => true, () => false))); expect(results.filter(Boolean)).toHaveLength(1);
  });
  it('does not resolve disabled modes, inactive points, or inactive tenants', async () => {
    const issued = await credentials.issue(tenantB, tableB); await modes.replace(tenantB, { enabledServicePointKinds: ['MOBILE_TAB'] });
    await expect(credentials.resolvePublic(issued.token)).rejects.toBeInstanceOf(NotFoundException);
    await modes.replace(tenantB, { enabledServicePointKinds: ['FIXED_TABLE'] }); await points.setActive(tenantB, tableB, false); await expect(credentials.resolvePublic(issued.token)).rejects.toBeInstanceOf(NotFoundException);
    await points.setActive(tenantB, tableB, true); await admin.query(`update tenants set status = 'SUSPENDED' where id = $1`, [tenantB]); await expect(credentials.resolvePublic(issued.token)).rejects.toBeInstanceOf(NotFoundException);
  });
});
