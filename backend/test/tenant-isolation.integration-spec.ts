import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { DatabaseService } from '../src/database/database.service.js';
import { TenantUserRepository } from '../src/database/repositories/tenant-user.repository.js';
import { tenantUsers } from '../src/database/schema/index.js';

describe('TenantUser RLS isolation', () => {
  const admin = new Pool({ connectionString: process.env.DATABASE_ADMIN_URL });
  const database = new DatabaseService();
  const repository = new TenantUserRepository();
  const tenantA = randomUUID();
  const tenantB = randomUUID();
  const userA = randomUUID();
  const userB = randomUUID();
  const userShared = randomUUID();

  beforeAll(async () => {
    await admin.query(
      `insert into tenants (id, name, slug) values
       ($1, 'Tenant A', $2), ($3, 'Tenant B', $4)`,
      [tenantA, `tenant-a-${tenantA}`, tenantB, `tenant-b-${tenantB}`],
    );
    await admin.query(
      `insert into users (id, email, name) values
       ($1, $2, 'User A'), ($3, $4, 'User B'), ($5, $6, 'Shared User')`,
      [
        userA,
        `${userA}@example.test`,
        userB,
        `${userB}@example.test`,
        userShared,
        `${userShared}@example.test`,
      ],
    );
    await admin.query(
      `insert into tenant_users (tenant_id, user_id) values
       ($1, $2), ($3, $4)`,
      [tenantA, userA, tenantB, userB],
    );
  });

  afterAll(async () => {
    await admin.query('delete from tenant_users where tenant_id = any($1)', [
      [tenantA, tenantB],
    ]);
    await admin.query('delete from users where id = any($1)', [
      [userA, userB, userShared],
    ]);
    await admin.query('delete from tenants where id = any($1)', [
      [tenantA, tenantB],
    ]);
    await database.onApplicationShutdown();
    await admin.end();
  });

  it('does not let tenant A read tenant B memberships', async () => {
    const rows = await database.withTenantContext(tenantA, (transaction) =>
      repository.findByTenant(transaction, tenantB),
    );

    expect(rows).toEqual([]);
  });

  it('does not let tenant A alter tenant B memberships', async () => {
    const rows = await database.withTenantContext(tenantA, (transaction) =>
      repository.updateStatus(transaction, tenantB, userB, 'INACTIVE'),
    );

    expect(rows).toEqual([]);
  });

  it('blocks a cross-tenant association', async () => {
    await expect(
      database.withTenantContext(tenantA, (transaction) =>
        repository.create(transaction, tenantB, userShared),
      ),
    ).rejects.toMatchObject({
      cause: {
        code: '42501',
      },
    });
  });

  it('does not expose tenant-scoped rows without context', async () => {
    const rows = await database.transaction((transaction) =>
      transaction.select().from(tenantUsers),
    );

    expect(rows).toEqual([]);
  });

  it('allows legitimate operations in the current tenant', async () => {
    const rows = await database.withTenantContext(
      tenantA,
      async (transaction) => {
        await repository.create(transaction, tenantA, userShared);

        return repository.findByTenant(transaction, tenantA);
      },
    );

    expect(rows.some((row) => row.userId === userShared)).toBe(true);
  });
});
