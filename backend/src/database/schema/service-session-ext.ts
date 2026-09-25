import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  integer,
  pgPolicy,
  pgTable,
  primaryKey,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { applicationRole } from './roles.js';
import { tenants } from './tenants.js';
import { serviceSessions } from './ordering.js';
import { orders } from './ordering.js';
import { orderItems } from './ordering.js';

const currentTenant = sql`nullif(current_setting('app.current_tenant_id', true), '')::uuid`;
const tenantPolicy = (name: string, tenantId: any) =>
  pgPolicy(name, {
    for: 'all',
    to: applicationRole,
    using: sql`${tenantId} = ${currentTenant}`,
    withCheck: sql`${tenantId} = ${currentTenant}`,
  });

export const serviceCalls = pgTable(
  'service_calls',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    serviceSessionId: uuid('service_session_id').notNull(),
    status: varchar('status', { length: 20 }).default('PENDING').notNull(),
    requestedAt: timestamp('requested_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    requestedBy: uuid('requested_by').notNull(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    resolvedBy: uuid('resolved_by'),
  },
  (t) => [
    unique('service_calls_tenant_id_id_unique').on(t.tenantId, t.id),
    foreignKey({
      name: 'service_calls_session_fk',
      columns: [t.tenantId, t.serviceSessionId],
      foreignColumns: [serviceSessions.tenantId, serviceSessions.id],
    }).onDelete('restrict'),
    check(
      'service_calls_status_valid',
      sql`${t.status} in ('PENDING','RESOLVED')`,
    ),
    index('service_calls_session_idx').on(t.serviceSessionId),
    tenantPolicy('service_calls_tenant_isolation', t.tenantId),
  ],
).enableRLS();

export const billRequests = pgTable(
  'bill_requests',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    serviceSessionId: uuid('service_session_id').notNull(),
    requestedAt: timestamp('requested_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    requestedBy: uuid('requested_by').notNull(),
    withdrawnAt: timestamp('withdrawn_at', { withTimezone: true }),
    withdrawnBy: uuid('withdrawn_by'),
  },
  (t) => [
    unique('bill_requests_tenant_id_id_unique').on(t.tenantId, t.id),
    unique('bill_requests_session_active_unique').on(t.tenantId, t.serviceSessionId),
    foreignKey({
      name: 'bill_requests_session_fk',
      columns: [t.tenantId, t.serviceSessionId],
      foreignColumns: [serviceSessions.tenantId, serviceSessions.id],
    }).onDelete('restrict'),
    index('bill_requests_session_idx').on(t.serviceSessionId),
    tenantPolicy('bill_requests_tenant_isolation', t.tenantId),
  ],
).enableRLS();

export const cancellationRequests = pgTable(
  'cancellation_requests',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    orderItemId: uuid('order_item_id').notNull(),
    reason: varchar('reason', { length: 500 }).notNull(),
    status: varchar('status', { length: 20 }).default('PENDING').notNull(),
    requestedBy: uuid('requested_by').notNull(),
    requestedAt: timestamp('requested_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    decidedBy: uuid('decided_by'),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    decisionNote: varchar('decision_note', { length: 500 }),
  },
  (t) => [
    unique('cancellation_requests_tenant_id_id_unique').on(t.tenantId, t.id),
    unique('cancellation_requests_item_pending_unique').on(t.tenantId, t.orderItemId),
    foreignKey({
      name: 'cancellation_requests_item_fk',
      columns: [t.tenantId, t.orderItemId],
      foreignColumns: [orderItems.tenantId, orderItems.id],
    }).onDelete('restrict'),
    check(
      'cancellation_requests_status_valid',
      sql`${t.status} in ('PENDING','APPROVED','REJECTED')`,
    ),
    tenantPolicy('cancellation_requests_tenant_isolation', t.tenantId),
  ],
).enableRLS();

export const serviceSessionTotals = pgTable(
  'service_session_totals',
  {
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    serviceSessionId: uuid('service_session_id').notNull(),
    originalTotalMinor: integer('original_total_minor').default(0).notNull(),
    cancelledTotalMinor: integer('cancelled_total_minor').default(0).notNull(),
    discountTotalMinor: integer('discount_total_minor').default(0).notNull(),
    additionalServiceTotalMinor: integer('additional_service_total_minor').default(0).notNull(),
    effectiveTotalMinor: integer('effective_total_minor').default(0).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    primaryKey({
      name: 'service_session_totals_pk',
      columns: [t.tenantId, t.serviceSessionId],
    }),
    foreignKey({
      name: 'service_session_totals_session_fk',
      columns: [t.tenantId, t.serviceSessionId],
      foreignColumns: [serviceSessions.tenantId, serviceSessions.id],
    }).onDelete('restrict'),
    tenantPolicy('service_session_totals_tenant_isolation', t.tenantId),
  ],
).enableRLS();