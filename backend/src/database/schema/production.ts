import { sql } from 'drizzle-orm';
import {
  boolean,
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
import { catalogProducts } from './catalog.js';

const currentTenant = sql`nullif(current_setting('app.current_tenant_id', true), '')::uuid`;
const tenantPolicy = (name: string, tenantId: any) =>
  pgPolicy(name, {
    for: 'all',
    to: applicationRole,
    using: sql`${tenantId} = ${currentTenant}`,
    withCheck: sql`${tenantId} = ${currentTenant}`,
  });

export const productionStations = pgTable(
  'production_stations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    name: varchar('name', { length: 80 }).notNull(),
    kind: varchar('kind', { length: 30 }).notNull(),
    active: boolean('active').default(true).notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    unique('production_stations_tenant_id_id_unique').on(t.tenantId, t.id),
    index('production_stations_tenant_kind_idx').on(t.tenantId, t.kind),
    check(
      'production_stations_name_not_blank',
      sql`btrim(${t.name}) <> ''`,
    ),
    check('production_stations_order_valid', sql`${t.sortOrder} >= 0`),
    tenantPolicy('production_stations_tenant_isolation', t.tenantId),
  ],
).enableRLS();

export const productRouting = pgTable(
  'product_routing',
  {
    tenantId: uuid('tenant_id').notNull(),
    productId: uuid('product_id').notNull(),
    stationId: uuid('station_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    primaryKey({
      name: 'product_routing_pk',
      columns: [t.tenantId, t.productId],
    }),
    foreignKey({
      name: 'product_routing_product_fk',
      columns: [t.tenantId, t.productId],
      foreignColumns: [catalogProducts.tenantId, catalogProducts.id],
    }).onDelete('restrict'),
    foreignKey({
      name: 'product_routing_station_fk',
      columns: [t.tenantId, t.stationId],
      foreignColumns: [productionStations.tenantId, productionStations.id],
    }).onDelete('restrict'),
    index('product_routing_tenant_station_idx').on(t.tenantId, t.stationId),
    tenantPolicy('product_routing_tenant_isolation', t.tenantId),
  ],
).enableRLS();

export type ProductionStationKind = 'KITCHEN' | 'BAR' | 'OTHER';
export const PRODUCTION_STATION_KINDS: ProductionStationKind[] = [
  'KITCHEN',
  'BAR',
  'OTHER',
];