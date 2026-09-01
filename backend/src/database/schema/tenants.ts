import { sql } from 'drizzle-orm';
import {
  check,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const tenants = pgTable(
  'tenants',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 160 }).notNull(),
    slug: varchar('slug', { length: 100 }).notNull(),
    status: varchar('status', { length: 20 }).default('ACTIVE').notNull(),
    timezone: varchar('timezone', { length: 100 })
      .default('America/Sao_Paulo')
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('tenants_slug_unique').on(table.slug),
    check('tenants_name_not_blank', sql`btrim(${table.name}) <> ''`),
    check(
      'tenants_slug_normalized',
      sql`${table.slug} = lower(btrim(${table.slug})) and ${table.slug} ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'`,
    ),
    check(
      'tenants_status_valid',
      sql`${table.status} in ('ACTIVE', 'INACTIVE', 'SUSPENDED')`,
    ),
  ],
);
