import { randomUUID } from 'node:crypto';
import { NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import { DatabaseService } from '../src/database/database.service.js';
import { TableQrRepository } from '../src/database/repositories/table-qr.repository.js';
import { TableRepository } from '../src/database/repositories/table.repository.js';
import {
  restaurantTables,
  tableQrCredentials,
} from '../src/database/schema/index.js';
import { TableQrTokenService } from '../src/tables/table-qr-token.service.js';
import { TableQrService } from '../src/tables/table-qr.service.js';
import { TableService } from '../src/tables/table.service.js';

describe('Tables and secure QR isolation', () => {
  const admin = new Pool({ connectionString: process.env.DATABASE_ADMIN_URL });
  const database = new DatabaseService();
  const tableRepository = new TableRepository();
  const qrRepository = new TableQrRepository();
  const tables = new TableService(database, tableRepository);
  const qr = new TableQrService(
    database,
    qrRepository,
    new TableQrTokenService(),
  );
  const tenantA = randomUUID();
  const tenantB = randomUUID();
  let tableA: string;
  let tableB: string;

  beforeAll(async () => {
    await admin.query(
      `insert into tenants (id, name, slug) values ($1, 'QR Tenant A', $2), ($3, 'QR Tenant B', $4)`,
      [tenantA, `qr-a-${tenantA}`, tenantB, `qr-b-${tenantB}`],
    );
    tableA = (await tables.create(tenantA, { label: 'Mesa A', code: 'A-1' }))
      .id;
    tableB = (await tables.create(tenantB, { label: 'Mesa B', code: 'B-1' }))
      .id;
  });

  afterAll(async () => {
    await admin.query(
      'delete from table_qr_credentials where tenant_id = any($1)',
      [[tenantA, tenantB]],
    );
    await admin.query(
      'delete from restaurant_tables where tenant_id = any($1)',
      [[tenantA, tenantB]],
    );
    await admin.query('delete from tenants where id = any($1)', [
      [tenantA, tenantB],
    ]);
    await database.onApplicationShutdown();
    await admin.end();
  });

  it('creates and reads only tables from the active tenant', async () => {
    expect((await tables.list(tenantA)).map(({ id }) => id)).toContain(tableA);
    expect((await tables.list(tenantA)).map(({ id }) => id)).not.toContain(
      tableB,
    );
    const changed = await database.withTenantContext(tenantA, (tx) =>
      tableRepository.update(tx, tenantB, tableB, { label: 'Leaked' }),
    );
    expect(changed).toEqual([]);
  });

  it('returns no tenant-scoped tables or QR rows without context', async () => {
    const result = await database.transaction(async (tx) => ({
      tables: await tx.select().from(restaurantTables),
      credentials: await tx.select().from(tableQrCredentials),
    }));
    expect(result).toEqual({ tables: [], credentials: [] });
  });

  it('stores only the token hash and resolves a minimal public context', async () => {
    const issued = await qr.issue(tenantA, tableA);
    const stored = await admin.query<{ token_hash: string }>(
      'select token_hash from table_qr_credentials where id = $1',
      [issued.credentialId],
    );
    expect(stored.rows[0].token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(stored.rows[0].token_hash).not.toBe(issued.token);
    const resolved = await qr.resolvePublic(issued.token);
    expect(resolved).toEqual({
      establishment: { name: 'QR Tenant A' },
      table: { label: 'Mesa A' },
    });
    expect(JSON.stringify(resolved)).not.toMatch(
      /tenantId|tableId|token|hash|active/,
    );
  });

  it('revokes immediately and treats revoked and unknown tokens alike', async () => {
    await qr.revoke(tenantA, tableA);
    const revokedToken = (
      await admin.query<{ token_hash: string }>(
        'select token_hash from table_qr_credentials where tenant_id = $1 order by created_at desc limit 1',
        [tenantA],
      )
    ).rows[0].token_hash;
    const unknownHash = new TableQrTokenService().generate().hash;
    const [revoked, unknown] = await Promise.all([
      database.transaction((tx) =>
        qrRepository.resolvePublic(tx, revokedToken),
      ),
      database.transaction((tx) => qrRepository.resolvePublic(tx, unknownHash)),
    ]);
    expect(revoked).toBeUndefined();
    expect(unknown).toBeUndefined();
  });

  it('invalidates the old token and resolves only the regenerated token', async () => {
    const old = await qr.issue(tenantA, tableA);
    const fresh = await qr.regenerate(tenantA, tableA);
    await expect(qr.resolvePublic(old.token)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(qr.resolvePublic(fresh.token)).resolves.toEqual({
      establishment: { name: 'QR Tenant A' },
      table: { label: 'Mesa A' },
    });
  });

  it('does not resolve an inactive table', async () => {
    await tables.setActive(tenantA, tableA, false);
    const active = await admin.query<{ token_hash: string }>(
      `select token_hash from table_qr_credentials where tenant_id = $1 and revoked_at is null`,
      [tenantA],
    );
    await expect(
      database.transaction((tx) =>
        qrRepository.resolvePublic(tx, active.rows[0].token_hash),
      ),
    ).resolves.toBeUndefined();
    await tables.setActive(tenantA, tableA, true);
  });

  it('rejects a cross-tenant table association', async () => {
    const generated = new TableQrTokenService().generate();
    await expect(
      database.withTenantContext(tenantA, (tx) =>
        qrRepository.create(tx, tenantA, tableB, generated.hash),
      ),
    ).rejects.toMatchObject({ cause: { code: '23503' } });
  });

  it('keeps one active credential under concurrent regeneration', async () => {
    const concurrentTable = (
      await tables.create(tenantA, { label: 'Concurrent' })
    ).id;
    await qr.issue(tenantA, concurrentTable);
    const rotated = await Promise.all([
      qr.regenerate(tenantA, concurrentTable),
      qr.regenerate(tenantA, concurrentTable),
    ]);
    const count = await admin.query<{ count: string }>(
      `select count(*) from table_qr_credentials where tenant_id = $1 and table_id = $2 and revoked_at is null`,
      [tenantA, concurrentTable],
    );
    expect(count.rows[0].count).toBe('1');
    const results = await Promise.all(
      rotated.map(({ token }) =>
        qr.resolvePublic(token).then(
          () => true,
          () => false,
        ),
      ),
    );
    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it('does not resolve credentials for an inactive tenant', async () => {
    const issued = await qr.issue(tenantB, tableB);
    await admin.query(`update tenants set status = 'SUSPENDED' where id = $1`, [
      tenantB,
    ]);
    await expect(qr.resolvePublic(issued.token)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
