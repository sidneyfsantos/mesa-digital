import { sql } from 'drizzle-orm';
import {
  check,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    email: varchar('email', { length: 320 }).notNull(),
    name: varchar('name', { length: 160 }).notNull(),
    passwordHash: varchar('password_hash', { length: 255 }),
    status: varchar('status', { length: 20 }).default('ACTIVE').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('users_email_unique').on(table.email),
    check(
      'users_email_normalized',
      sql`${table.email} = lower(btrim(${table.email}))`,
    ),
    check('users_name_not_blank', sql`btrim(${table.name}) <> ''`),
    check(
      'users_status_valid',
      sql`${table.status} in ('ACTIVE', 'INACTIVE', 'SUSPENDED')`,
    ),
  ],
);
