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
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { applicationRole } from './roles.js';
import { tenants } from './tenants.js';
const currentTenant = sql`nullif(current_setting('app.current_tenant_id', true), '')::uuid`;
const tenantPolicy = (name: string, tenantId: any) =>
  pgPolicy(name, {
    for: 'all',
    to: applicationRole,
    using: sql`${tenantId} = ${currentTenant}`,
    withCheck: sql`${tenantId} = ${currentTenant}`,
  });

export const mediaAssets = pgTable(
  'media_assets',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    storageProvider: varchar('storage_provider', { length: 30 })
      .default('LOCAL')
      .notNull(),
    storageKey: varchar('storage_key', { length: 240 }).notNull(),
    mimeType: varchar('mime_type', { length: 80 }).notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    width: integer('width'),
    height: integer('height'),
    altText: varchar('alt_text', { length: 180 }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    unique('media_assets_tenant_id_id_unique').on(t.tenantId, t.id),
    unique('media_assets_storage_key_unique').on(t.storageKey),
    check(
      'media_assets_size_valid',
      sql`${t.sizeBytes} > 0 and ${t.sizeBytes} <= 5242880`,
    ),
    check(
      'media_assets_mime_valid',
      sql`${t.mimeType} in ('image/jpeg','image/png','image/webp')`,
    ),
    tenantPolicy('media_assets_tenant_isolation', t.tenantId),
  ],
).enableRLS();

export const tenantBranding = pgTable(
  'tenant_branding',
  {
    tenantId: uuid('tenant_id')
      .primaryKey()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    displayName: varchar('display_name', { length: 160 }).notNull(),
    primaryColor: varchar('primary_color', { length: 7 })
      .default('#C2410C')
      .notNull(),
    logoMediaId: uuid('logo_media_id'),
    coverMediaId: uuid('cover_media_id'),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    foreignKey({
      name: 'tenant_branding_logo_fk',
      columns: [t.tenantId, t.logoMediaId],
      foreignColumns: [mediaAssets.tenantId, mediaAssets.id],
    }).onDelete('restrict'),
    foreignKey({
      name: 'tenant_branding_cover_fk',
      columns: [t.tenantId, t.coverMediaId],
      foreignColumns: [mediaAssets.tenantId, mediaAssets.id],
    }).onDelete('restrict'),
    check('tenant_branding_name_not_blank', sql`btrim(${t.displayName}) <> ''`),
    check(
      'tenant_branding_color_valid',
      sql`${t.primaryColor} ~ '^#[0-9A-F]{6}$'`,
    ),
    tenantPolicy('tenant_branding_tenant_isolation', t.tenantId),
  ],
).enableRLS();

export const catalogCategories = pgTable(
  'catalog_categories',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    name: varchar('name', { length: 100 }).notNull(),
    description: text('description'),
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
    unique('catalog_categories_tenant_id_id_unique').on(t.tenantId, t.id),
    index('catalog_categories_tenant_order_idx').on(
      t.tenantId,
      t.sortOrder,
      t.id,
    ),
    check('catalog_categories_name_not_blank', sql`btrim(${t.name}) <> ''`),
    check('catalog_categories_order_valid', sql`${t.sortOrder} >= 0`),
    tenantPolicy('catalog_categories_tenant_isolation', t.tenantId),
  ],
).enableRLS();

export const catalogProducts = pgTable(
  'catalog_products',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    categoryId: uuid('category_id').notNull(),
    name: varchar('name', { length: 140 }).notNull(),
    description: text('description'),
    priceMinor: integer('price_minor').notNull(),
    currency: varchar('currency', { length: 3 }).default('BRL').notNull(),
    active: boolean('active').default(true).notNull(),
    available: boolean('available').default(true).notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    unique('catalog_products_tenant_id_id_unique').on(t.tenantId, t.id),
    foreignKey({
      name: 'catalog_products_tenant_category_fk',
      columns: [t.tenantId, t.categoryId],
      foreignColumns: [catalogCategories.tenantId, catalogCategories.id],
    }).onDelete('restrict'),
    index('catalog_products_tenant_category_order_idx').on(
      t.tenantId,
      t.categoryId,
      t.sortOrder,
      t.id,
    ),
    check('catalog_products_name_not_blank', sql`btrim(${t.name}) <> ''`),
    check('catalog_products_price_valid', sql`${t.priceMinor} >= 0`),
    check('catalog_products_currency_valid', sql`${t.currency} = 'BRL'`),
    check('catalog_products_order_valid', sql`${t.sortOrder} >= 0`),
    tenantPolicy('catalog_products_tenant_isolation', t.tenantId),
  ],
).enableRLS();

export const modifierGroups = pgTable(
  'modifier_groups',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    name: varchar('name', { length: 100 }).notNull(),
    required: boolean('required').default(false).notNull(),
    minSelections: integer('min_selections').default(0).notNull(),
    maxSelections: integer('max_selections').default(1).notNull(),
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
    unique('modifier_groups_tenant_id_id_unique').on(t.tenantId, t.id),
    index('modifier_groups_tenant_order_idx').on(t.tenantId, t.sortOrder, t.id),
    check('modifier_groups_name_not_blank', sql`btrim(${t.name}) <> ''`),
    check(
      'modifier_groups_selections_valid',
      sql`${t.minSelections} >= 0 and ${t.maxSelections} >= 1 and ${t.minSelections} <= ${t.maxSelections}`,
    ),
    check(
      'modifier_groups_required_valid',
      sql`(${t.required} = false) or (${t.minSelections} >= 1)`,
    ),
    tenantPolicy('modifier_groups_tenant_isolation', t.tenantId),
  ],
).enableRLS();

export const modifierOptions = pgTable(
  'modifier_options',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    groupId: uuid('group_id').notNull(),
    name: varchar('name', { length: 100 }).notNull(),
    priceDeltaMinor: integer('price_delta_minor').default(0).notNull(),
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
    unique('modifier_options_tenant_id_id_unique').on(t.tenantId, t.id),
    foreignKey({
      name: 'modifier_options_tenant_group_fk',
      columns: [t.tenantId, t.groupId],
      foreignColumns: [modifierGroups.tenantId, modifierGroups.id],
    }).onDelete('restrict'),
    index('modifier_options_tenant_group_order_idx').on(
      t.tenantId,
      t.groupId,
      t.sortOrder,
      t.id,
    ),
    check('modifier_options_name_not_blank', sql`btrim(${t.name}) <> ''`),
    check('modifier_options_price_valid', sql`${t.priceDeltaMinor} >= 0`),
    tenantPolicy('modifier_options_tenant_isolation', t.tenantId),
  ],
).enableRLS();

export const productModifierGroups = pgTable(
  'product_modifier_groups',
  {
    tenantId: uuid('tenant_id').notNull(),
    productId: uuid('product_id').notNull(),
    modifierGroupId: uuid('modifier_group_id').notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    primaryKey({
      name: 'product_modifier_groups_pk',
      columns: [t.tenantId, t.productId, t.modifierGroupId],
    }),
    foreignKey({
      name: 'product_modifier_groups_product_fk',
      columns: [t.tenantId, t.productId],
      foreignColumns: [catalogProducts.tenantId, catalogProducts.id],
    }).onDelete('restrict'),
    foreignKey({
      name: 'product_modifier_groups_group_fk',
      columns: [t.tenantId, t.modifierGroupId],
      foreignColumns: [modifierGroups.tenantId, modifierGroups.id],
    }).onDelete('restrict'),
    index('product_modifier_groups_tenant_product_order_idx').on(
      t.tenantId,
      t.productId,
      t.sortOrder,
    ),
    tenantPolicy('product_modifier_groups_tenant_isolation', t.tenantId),
  ],
).enableRLS();

export const productMedia = pgTable(
  'product_media',
  {
    tenantId: uuid('tenant_id').notNull(),
    productId: uuid('product_id').notNull(),
    mediaId: uuid('media_id').notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    primaryKey({
      name: 'product_media_pk',
      columns: [t.tenantId, t.productId, t.mediaId],
    }),
    foreignKey({
      name: 'product_media_product_fk',
      columns: [t.tenantId, t.productId],
      foreignColumns: [catalogProducts.tenantId, catalogProducts.id],
    }).onDelete('restrict'),
    foreignKey({
      name: 'product_media_asset_fk',
      columns: [t.tenantId, t.mediaId],
      foreignColumns: [mediaAssets.tenantId, mediaAssets.id],
    }).onDelete('restrict'),
    index('product_media_tenant_product_order_idx').on(
      t.tenantId,
      t.productId,
      t.sortOrder,
    ),
    tenantPolicy('product_media_tenant_isolation', t.tenantId),
  ],
).enableRLS();
