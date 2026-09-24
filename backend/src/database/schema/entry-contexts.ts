import { sql } from 'drizzle-orm';
import { boolean, check, foreignKey, index, pgPolicy, pgTable, primaryKey, timestamp, unique, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { applicationRole } from './roles.js';
import { tenants } from './tenants.js';

const currentTenant = sql`nullif(current_setting('app.current_tenant_id', true), '')::uuid`;
export const SERVICE_POINT_KINDS = ['FIXED_TABLE', 'MOBILE_TAB'] as const;

export const servicePoints = pgTable('service_points', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'restrict' }),
  kind: varchar('kind', { length: 30 }).notNull(),
  label: varchar('label', { length: 100 }).notNull(),
  code: varchar('code', { length: 50 }),
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  unique('service_points_tenant_id_id_unique').on(table.tenantId, table.id),
  uniqueIndex('service_points_tenant_code_unique').on(table.tenantId, table.code).where(sql`${table.code} is not null`),
  index('service_points_tenant_id_kind_idx').on(table.tenantId, table.kind),
  check('service_points_kind_valid', sql`${table.kind} in ('FIXED_TABLE', 'MOBILE_TAB')`),
  check('service_points_label_not_blank', sql`btrim(${table.label}) <> ''`),
  check('service_points_code_not_blank', sql`${table.code} is null or btrim(${table.code}) <> ''`),
  pgPolicy('service_points_tenant_isolation', { for: 'all', to: applicationRole, using: sql`${table.tenantId} = ${currentTenant}`, withCheck: sql`${table.tenantId} = ${currentTenant}` }),
]).enableRLS();

export const tenantEntryModes = pgTable('tenant_entry_modes', {
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'restrict' }),
  servicePointKind: varchar('service_point_kind', { length: 30 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  primaryKey({ name: 'tenant_entry_modes_tenant_kind_pk', columns: [table.tenantId, table.servicePointKind] }),
  check('tenant_entry_modes_kind_valid', sql`${table.servicePointKind} in ('FIXED_TABLE', 'MOBILE_TAB')`),
  pgPolicy('tenant_entry_modes_tenant_isolation', { for: 'all', to: applicationRole, using: sql`${table.tenantId} = ${currentTenant}`, withCheck: sql`${table.tenantId} = ${currentTenant}` }),
]).enableRLS();

export const entryCredentials = pgTable('entry_credentials', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull(),
  servicePointId: uuid('service_point_id').notNull(),
  kind: varchar('kind', { length: 20 }).default('QR').notNull(),
  tokenHash: varchar('token_hash', { length: 64 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
}, (table) => [
  unique('entry_credentials_token_hash_unique').on(table.tokenHash),
  unique('entry_credentials_tenant_id_id_unique').on(table.tenantId, table.id),
  uniqueIndex('entry_credentials_one_active_qr_per_service_point').on(table.tenantId, table.servicePointId, table.kind).where(sql`${table.revokedAt} is null`),
  foreignKey({ name: 'entry_credentials_tenant_service_point_fk', columns: [table.tenantId, table.servicePointId], foreignColumns: [servicePoints.tenantId, servicePoints.id] }).onDelete('restrict'),
  index('entry_credentials_tenant_service_point_idx').on(table.tenantId, table.servicePointId),
  check('entry_credentials_kind_valid', sql`${table.kind} = 'QR'`),
  check('entry_credentials_hash_format', sql`${table.tokenHash} ~ '^[0-9a-f]{64}$'`),
  pgPolicy('entry_credentials_tenant_isolation', { for: 'all', to: applicationRole, using: sql`${table.tenantId} = ${currentTenant}`, withCheck: sql`${table.tenantId} = ${currentTenant}` }),
]).enableRLS();
