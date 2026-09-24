import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  pgPolicy,
  pgTable,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { applicationRole } from './roles.js';
import { tenantUsers } from './tenant-users.js';
import { tenants } from './tenants.js';
import { users } from './users.js';
const currentTenant = sql`nullif(current_setting('app.current_tenant_id',true),'')::uuid`;
export const authSessions = pgTable(
  'auth_sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    tenantUserId: uuid('tenant_user_id').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    tokenHash: varchar('token_hash', { length: 64 }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    unique('auth_sessions_token_hash_unique').on(t.tokenHash),
    tenantUsersFk(t),
    index('auth_sessions_tenant_user_idx').on(t.tenantId, t.tenantUserId),
    check(
      'auth_sessions_token_hash_valid',
      sql`${t.tokenHash} ~ '^[0-9a-f]{64}$'`,
    ),
    pgPolicy('auth_sessions_tenant_isolation', {
      for: 'all',
      to: applicationRole,
      using: sql`${t.tenantId}=${currentTenant}`,
      withCheck: sql`${t.tenantId}=${currentTenant}`,
    }),
  ],
).enableRLS();
function tenantUsersFk(t: any) {
  return foreignKey({
    name: 'auth_sessions_tenant_user_fk',
    columns: [t.tenantId, t.tenantUserId],
    foreignColumns: [tenantUsers.tenantId, tenantUsers.id],
  });
}
