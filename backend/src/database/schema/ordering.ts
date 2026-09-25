import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgPolicy,
  pgTable,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { applicationRole } from './roles.js';
import { entryCredentials, servicePoints } from './entry-contexts.js';
import { productionStations } from './production.js';
import { tenants } from './tenants.js';
const ct = sql`nullif(current_setting('app.current_tenant_id',true),'')::uuid`;
const policy = (n: string, c: any) =>
  pgPolicy(n, {
    for: 'all',
    to: applicationRole,
    using: sql`${c}=${ct}`,
    withCheck: sql`${c}=${ct}`,
  });
export const serviceSessions = pgTable(
  'service_sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    servicePointId: uuid('service_point_id').notNull(),
    entryCredentialId: uuid('entry_credential_id').notNull(),
    status: varchar('status', { length: 20 }).default('OPEN').notNull(),
    openedAt: timestamp('opened_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    closedAt: timestamp('closed_at', { withTimezone: true }),
  },
  (t) => [
    unique('service_sessions_tenant_id_id_unique').on(t.tenantId, t.id),
    foreignKey({
      name: 'service_sessions_point_fk',
      columns: [t.tenantId, t.servicePointId],
      foreignColumns: [servicePoints.tenantId, servicePoints.id],
    }),
    foreignKey({
      name: 'service_sessions_credential_fk',
      columns: [t.tenantId, t.entryCredentialId],
      foreignColumns: [entryCredentials.tenantId, entryCredentials.id],
    }),
    check(
      'service_sessions_status_valid',
      sql`${t.status} in ('OPEN','CHECK_REQUESTED','CLOSING','CLOSED')`,
    ),
    policy('service_sessions_tenant_isolation', t.tenantId),
  ],
).enableRLS();
export const orders = pgTable(
  'orders',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    serviceSessionId: uuid('service_session_id').notNull(),
    reference: varchar('reference', { length: 12 }).notNull(),
    status: varchar('status', { length: 20 }).default('ACCEPTED').notNull(),
    idempotencyKey: varchar('idempotency_key', { length: 100 }).notNull(),
    payloadHash: varchar('payload_hash', { length: 64 }).notNull(),
    totalMinor: integer('total_minor').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    unique('orders_tenant_id_id_unique').on(t.tenantId, t.id),
    unique('orders_tenant_idempotency_unique').on(t.tenantId, t.idempotencyKey),
    foreignKey({
      name: 'orders_session_fk',
      columns: [t.tenantId, t.serviceSessionId],
      foreignColumns: [serviceSessions.tenantId, serviceSessions.id],
    }),
    check('orders_total_valid', sql`${t.totalMinor}>=0`),
    policy('orders_tenant_isolation', t.tenantId),
  ],
).enableRLS();
export const orderItems = pgTable(
  'order_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    orderId: uuid('order_id').notNull(),
    productId: uuid('product_id').notNull(),
    stationId: uuid('station_id'),
    quantity: integer('quantity').notNull(),
    status: varchar('status', { length: 30 }).default('ACCEPTED').notNull(),
    productNameSnapshot: varchar('product_name_snapshot', {
      length: 140,
    }).notNull(),
    unitPriceMinor: integer('unit_price_minor').notNull(),
    modifiersTotalMinor: integer('modifiers_total_minor').notNull(),
    lineTotalMinor: integer('line_total_minor').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    readyAt: timestamp('ready_at', { withTimezone: true }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
  },
  (t) => [
    unique('order_items_tenant_id_id_unique').on(t.tenantId, t.id),
    foreignKey({
      name: 'order_items_order_fk',
      columns: [t.tenantId, t.orderId],
      foreignColumns: [orders.tenantId, orders.id],
    }),
    foreignKey({
      name: 'order_items_station_fk',
      columns: [t.tenantId, t.stationId],
      foreignColumns: [productionStations.tenantId, productionStations.id],
    }),
    check('order_items_quantity_valid', sql`${t.quantity}>0`),
    check(
      'order_items_status_valid',
      sql`${t.status} in ('ACCEPTED','IN_PREPARATION','READY','DELIVERED','CANCELLED')`,
    ),
    policy('order_items_tenant_isolation', t.tenantId),
  ],
).enableRLS();
export const orderItemModifiers = pgTable(
  'order_item_modifiers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    orderItemId: uuid('order_item_id').notNull(),
    modifierGroupId: uuid('modifier_group_id').notNull(),
    modifierOptionId: uuid('modifier_option_id').notNull(),
    groupNameSnapshot: varchar('group_name_snapshot', {
      length: 100,
    }).notNull(),
    optionNameSnapshot: varchar('option_name_snapshot', {
      length: 100,
    }).notNull(),
    priceDeltaMinor: integer('price_delta_minor').notNull(),
  },
  (t) => [
    foreignKey({
      name: 'order_item_modifiers_item_fk',
      columns: [t.tenantId, t.orderItemId],
      foreignColumns: [orderItems.tenantId, orderItems.id],
    }),
    policy('order_item_modifiers_tenant_isolation', t.tenantId),
  ],
).enableRLS();
export const orderStatusHistory = pgTable(
  'order_status_history',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    orderId: uuid('order_id').notNull(),
    status: varchar('status', { length: 20 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    foreignKey({
      name: 'order_history_order_fk',
      columns: [t.tenantId, t.orderId],
      foreignColumns: [orders.tenantId, orders.id],
    }),
    policy('order_history_tenant_isolation', t.tenantId),
  ],
).enableRLS();
export const outboxEvents = pgTable(
  'outbox_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    aggregateType: varchar('aggregate_type', { length: 50 }).notNull(),
    aggregateId: uuid('aggregate_id').notNull(),
    eventType: varchar('event_type', { length: 100 }).notNull(),
    payload: jsonb('payload').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    publishedAt: timestamp('published_at', { withTimezone: true }),
  },
  (t) => [
    index('outbox_unpublished_idx').on(t.publishedAt, t.createdAt),
    policy('outbox_tenant_isolation', t.tenantId),
  ],
).enableRLS();
