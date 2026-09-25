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
import { users } from './users.js';

const currentTenant = sql`nullif(current_setting('app.current_tenant_id', true), '')::uuid`;
const tenantPolicy = (name: string, tenantId: any) =>
  pgPolicy(name, {
    for: 'all',
    to: applicationRole,
    using: sql`${tenantId} = ${currentTenant}`,
    withCheck: sql`${tenantId} = ${currentTenant}`,
  });

export const onboardingStates = pgTable(
  'onboarding_states',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    step: varchar('step', { length: 50 }).notNull(),
    data: varchar('data', { length: 5000 }).default('{}').notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    unique('onboarding_states_tenant_id_id_unique').on(t.tenantId, t.id),
    foreignKey({
      name: 'onboarding_states_tenant_fk',
      columns: [t.tenantId],
      foreignColumns: [tenants.id],
    }).onDelete('restrict'),
    index('onboarding_states_tenant_idx').on(t.tenantId),
    check(
      'onboarding_states_step_valid',
      sql`${t.step} in ('BASIC_DATA','IDENTITY','ENTRY_MODE','SERVICE_POINTS','STATIONS','CATALOG','COMPLETED')`,
    ),
    tenantPolicy('onboarding_states_tenant_isolation', t.tenantId),
  ],
).enableRLS();

export type OnboardingStep =
  | 'BASIC_DATA'
  | 'IDENTITY'
  | 'ENTRY_MODE'
  | 'SERVICE_POINTS'
  | 'STATIONS'
  | 'CATALOG'
  | 'COMPLETED';

export const ONBOARDING_STEPS: OnboardingStep[] = [
  'BASIC_DATA',
  'IDENTITY',
  'ENTRY_MODE',
  'SERVICE_POINTS',
  'STATIONS',
  'CATALOG',
  'COMPLETED',
];

export const ONBOARDING_STEP_LABELS: Record<OnboardingStep, string> = {
  BASIC_DATA: 'Dados do Estabelecimento',
  IDENTITY: 'Identidade Visual',
  ENTRY_MODE: 'Modo de Atendimento',
  SERVICE_POINTS: 'Mesas / Comandas',
  STATIONS: 'Estações (Cozinha/Bar)',
  CATALOG: 'Cardápio',
  COMPLETED: 'Pronto para Operar',
};