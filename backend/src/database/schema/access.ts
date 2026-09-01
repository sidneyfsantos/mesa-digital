import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  foreignKey,
  index,
  pgPolicy,
  pgTable,
  primaryKey,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { applicationRole } from './roles.js';
import { tenantUsers } from './tenant-users.js';
import { tenants } from './tenants.js';

const currentTenant = sql`nullif(current_setting('app.current_tenant_id', true), '')::uuid`;

export const capabilities = pgTable(
  'capabilities',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    key: varchar('key', { length: 100 }).notNull(),
    description: varchar('description', { length: 240 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique('capabilities_key_unique').on(table.key),
    check(
      'capabilities_key_normalized',
      sql`${table.key} = lower(btrim(${table.key})) and ${table.key} ~ '^[a-z]+(?:[._][a-z]+)*$'`,
    ),
  ],
);

export const accessRoles = pgTable(
  'roles',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    key: varchar('key', { length: 50 }).notNull(),
    name: varchar('name', { length: 100 }).notNull(),
    isSystem: boolean('is_system').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique('roles_tenant_id_key_unique').on(table.tenantId, table.key),
    unique('roles_tenant_id_id_unique').on(table.tenantId, table.id),
    index('roles_tenant_id_idx').on(table.tenantId),
    check(
      'roles_key_normalized',
      sql`${table.key} = lower(btrim(${table.key})) and ${table.key} ~ '^[a-z]+(?:_[a-z]+)*$'`,
    ),
    pgPolicy('roles_tenant_isolation', {
      for: 'all',
      to: applicationRole,
      using: sql`${table.tenantId} = ${currentTenant}`,
      withCheck: sql`${table.tenantId} = ${currentTenant}`,
    }),
  ],
).enableRLS();

export const roleCapabilities = pgTable(
  'role_capabilities',
  {
    tenantId: uuid('tenant_id').notNull(),
    roleId: uuid('role_id').notNull(),
    capabilityId: uuid('capability_id')
      .notNull()
      .references(() => capabilities.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({
      name: 'role_capabilities_tenant_role_capability_pk',
      columns: [table.tenantId, table.roleId, table.capabilityId],
    }),
    foreignKey({
      name: 'role_capabilities_tenant_role_fk',
      columns: [table.tenantId, table.roleId],
      foreignColumns: [accessRoles.tenantId, accessRoles.id],
    }).onDelete('restrict'),
    index('role_capabilities_tenant_id_idx').on(table.tenantId),
    pgPolicy('role_capabilities_tenant_isolation', {
      for: 'all',
      to: applicationRole,
      using: sql`${table.tenantId} = ${currentTenant}`,
      withCheck: sql`${table.tenantId} = ${currentTenant}`,
    }),
  ],
).enableRLS();

export const tenantUserRoles = pgTable(
  'tenant_user_roles',
  {
    tenantId: uuid('tenant_id').notNull(),
    tenantUserId: uuid('tenant_user_id').notNull(),
    roleId: uuid('role_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({
      name: 'tenant_user_roles_tenant_user_role_pk',
      columns: [table.tenantId, table.tenantUserId, table.roleId],
    }),
    foreignKey({
      name: 'tenant_user_roles_tenant_user_fk',
      columns: [table.tenantId, table.tenantUserId],
      foreignColumns: [tenantUsers.tenantId, tenantUsers.id],
    }).onDelete('restrict'),
    foreignKey({
      name: 'tenant_user_roles_tenant_role_fk',
      columns: [table.tenantId, table.roleId],
      foreignColumns: [accessRoles.tenantId, accessRoles.id],
    }).onDelete('restrict'),
    index('tenant_user_roles_tenant_user_idx').on(
      table.tenantId,
      table.tenantUserId,
    ),
    pgPolicy('tenant_user_roles_tenant_isolation', {
      for: 'all',
      to: applicationRole,
      using: sql`${table.tenantId} = ${currentTenant}`,
      withCheck: sql`${table.tenantId} = ${currentTenant}`,
    }),
  ],
).enableRLS();
