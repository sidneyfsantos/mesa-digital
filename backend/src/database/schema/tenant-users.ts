import { sql } from 'drizzle-orm';
import {
  check,
  index,
  pgPolicy,
  pgTable,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { applicationRole } from './roles.js';
import { tenants } from './tenants.js';
import { users } from './users.js';

const currentTenant = sql`nullif(current_setting('app.current_tenant_id', true), '')::uuid`;

export const tenantUsers = pgTable(
  'tenant_users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    status: varchar('status', { length: 20 }).default('ACTIVE').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique('tenant_users_tenant_id_user_id_unique').on(
      table.tenantId,
      table.userId,
    ),
    unique('tenant_users_tenant_id_id_unique').on(table.tenantId, table.id),
    index('tenant_users_user_id_idx').on(table.userId),
    check(
      'tenant_users_status_valid',
      sql`${table.status} in ('ACTIVE', 'INACTIVE')`,
    ),
    pgPolicy('tenant_users_tenant_isolation', {
      as: 'permissive',
      for: 'all',
      to: applicationRole,
      using: sql`${table.tenantId} = ${currentTenant}`,
      withCheck: sql`${table.tenantId} = ${currentTenant}`,
    }),
  ],
).enableRLS();
