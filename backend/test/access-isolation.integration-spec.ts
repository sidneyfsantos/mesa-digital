import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { AuthorizationBootstrapService } from '../src/auth/authorization-bootstrap.service.js';
import { AccessRepository } from '../src/database/repositories/access.repository.js';
import { DatabaseService } from '../src/database/database.service.js';
import {
  accessRoles,
  roleCapabilities,
  tenantUserRoles,
} from '../src/database/schema/index.js';

describe('Access multi-tenant isolation', () => {
  const admin = new Pool({ connectionString: process.env.DATABASE_ADMIN_URL });
  const database = new DatabaseService();
  const bootstrap = new AuthorizationBootstrapService(database);
  const repository = new AccessRepository();
  const tenantA = randomUUID();
  const tenantB = randomUUID();
  const user = randomUUID();
  let tenantUserA: string;
  let tenantUserB: string;

  beforeAll(async () => {
    await admin.query(
      `insert into tenants (id, name, slug) values ($1, 'Access A', $2), ($3, 'Access B', $4)`,
      [tenantA, `access-a-${tenantA}`, tenantB, `access-b-${tenantB}`],
    );
    await admin.query(
      `insert into users (id, email, name) values ($1, $2, 'Multi tenant user')`,
      [user, `${user}@example.test`],
    );
    const result = await admin.query<{ id: string }>(
      `insert into tenant_users (tenant_id, user_id) values ($1, $3), ($2, $3) returning id`,
      [tenantA, tenantB, user],
    );
    [tenantUserA, tenantUserB] = result.rows.map(({ id }) => id);
    await bootstrap.bootstrapTenant(tenantA);
    await bootstrap.bootstrapTenant(tenantB);
  });

  afterAll(async () => {
    await admin.query(
      'delete from tenant_user_roles where tenant_id = any($1)',
      [[tenantA, tenantB]],
    );
    await admin.query(
      'delete from role_capabilities where tenant_id = any($1)',
      [[tenantA, tenantB]],
    );
    await admin.query('delete from roles where tenant_id = any($1)', [
      [tenantA, tenantB],
    ]);
    await admin.query('delete from tenant_users where tenant_id = any($1)', [
      [tenantA, tenantB],
    ]);
    await admin.query('delete from users where id = $1', [user]);
    await admin.query('delete from tenants where id = any($1)', [
      [tenantA, tenantB],
    ]);
    await database.onApplicationShutdown();
    await admin.end();
  });

  it('supports one global user in multiple tenants', async () => {
    expect(tenantUserA).not.toBe(tenantUserB);
  });

  it('bootstraps standard roles and assignments idempotently', async () => {
    const before = await admin.query<{ count: string }>(
      'select count(*) from roles where tenant_id = $1',
      [tenantA],
    );
    await bootstrap.bootstrapTenant(tenantA);
    const after = await admin.query<{ count: string }>(
      'select count(*) from roles where tenant_id = $1',
      [tenantA],
    );
    expect(before.rows[0].count).toBe('5');
    expect(after.rows[0].count).toBe(before.rows[0].count);
  });

  it('keeps roles and capabilities isolated by tenant', async () => {
    const roleA = await admin.query<{ id: string }>(
      `select id from roles where tenant_id = $1 and key = 'owner'`,
      [tenantA],
    );
    await database.withTenantContext(tenantA, (tx) =>
      repository.assignRole(tx, tenantA, tenantUserA, roleA.rows[0].id),
    );
    const grantedA = await database.withTenantContext(tenantA, (tx) =>
      repository.findEffectiveCapabilities(tx, tenantA, tenantUserA),
    );
    const grantedB = await database.withTenantContext(tenantB, (tx) =>
      repository.findEffectiveCapabilities(tx, tenantB, tenantUserB),
    );
    expect(grantedA).toContain('tenant.manage');
    expect(grantedB).toEqual([]);
  });

  it('does not expose tenant-scoped access data without context', async () => {
    const result = await database.transaction(async (tx) => ({
      roles: await tx.select().from(accessRoles),
      roleCapabilities: await tx.select().from(roleCapabilities),
      tenantUserRoles: await tx.select().from(tenantUserRoles),
    }));
    expect(result).toEqual({
      roles: [],
      roleCapabilities: [],
      tenantUserRoles: [],
    });
  });

  it('rejects assigning a role from another tenant', async () => {
    const roleB = await admin.query<{ id: string }>(
      `select id from roles where tenant_id = $1 and key = 'manager'`,
      [tenantB],
    );
    await expect(
      database.withTenantContext(tenantA, (tx) =>
        repository.assignRole(tx, tenantA, tenantUserA, roleB.rows[0].id),
      ),
    ).rejects.toMatchObject({ cause: { code: '23503' } });
  });
});
