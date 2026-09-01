import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  foreignKey,
  index,
  pgPolicy,
  pgTable,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { applicationRole } from './roles.js';
import { tenants } from './tenants.js';
const currentTenant = sql`nullif(current_setting('app.current_tenant_id', true), '')::uuid`;

export const restaurantTables = pgTable(
  'restaurant_tables',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    label: varchar('label', { length: 100 }).notNull(),
    code: varchar('code', { length: 50 }),
    active: boolean('active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique('restaurant_tables_tenant_id_id_unique').on(
      table.tenantId,
      table.id,
    ),
    uniqueIndex('restaurant_tables_tenant_code_unique')
      .on(table.tenantId, table.code)
      .where(sql`${table.code} is not null`),
    index('restaurant_tables_tenant_id_idx').on(table.tenantId),
    check(
      'restaurant_tables_label_not_blank',
      sql`btrim(${table.label}) <> ''`,
    ),
    check(
      'restaurant_tables_code_not_blank',
      sql`${table.code} is null or btrim(${table.code}) <> ''`,
    ),
    pgPolicy('restaurant_tables_tenant_isolation', {
      for: 'all',
      to: applicationRole,
      using: sql`${table.tenantId} = ${currentTenant}`,
      withCheck: sql`${table.tenantId} = ${currentTenant}`,
    }),
  ],
).enableRLS();

export const tableQrCredentials = pgTable(
  'table_qr_credentials',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    tableId: uuid('table_id').notNull(),
    tokenHash: varchar('token_hash', { length: 64 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (table) => [
    unique('table_qr_credentials_token_hash_unique').on(table.tokenHash),
    unique('table_qr_credentials_tenant_id_id_unique').on(
      table.tenantId,
      table.id,
    ),
    uniqueIndex('table_qr_credentials_one_active_per_table')
      .on(table.tenantId, table.tableId)
      .where(sql`${table.revokedAt} is null`),
    foreignKey({
      name: 'table_qr_credentials_tenant_table_fk',
      columns: [table.tenantId, table.tableId],
      foreignColumns: [restaurantTables.tenantId, restaurantTables.id],
    }).onDelete('restrict'),
    index('table_qr_credentials_tenant_table_idx').on(
      table.tenantId,
      table.tableId,
    ),
    check(
      'table_qr_credentials_hash_format',
      sql`${table.tokenHash} ~ '^[0-9a-f]{64}$'`,
    ),
    pgPolicy('table_qr_credentials_tenant_isolation', {
      for: 'all',
      to: applicationRole,
      using: sql`${table.tenantId} = ${currentTenant}`,
      withCheck: sql`${table.tenantId} = ${currentTenant}`,
    }),
  ],
).enableRLS();
