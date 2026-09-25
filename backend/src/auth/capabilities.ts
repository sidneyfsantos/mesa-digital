export const CAPABILITIES = [
  'tenant.manage',
  'user.read',
  'user.manage',
  'role.read',
  'role.manage',
  'catalog.read',
  'catalog.manage',
  'service_point.read',
  'service_point.manage',
  'qr.manage',
  'order.read',
  'order.create',
  'order.manage',
  'production.read',
  'production.manage',
  'cancellation.request',
  'cancellation.approve',
  'session.read',
  'session.withdraw_check_request',
  'session.start_closing',
  'session.close',
  'session.correct_closed',
  'service_call.create',
  'service_call.read',
  'service_call.manage',
  'bill.read',
  'audit.read',
  'report.read',
] as const;

export type Capability = (typeof CAPABILITIES)[number];
export type StandardRole = 'owner' | 'manager' | 'waiter' | 'kitchen' | 'bar';

const management: Capability[] = [
  'user.read',
  'user.manage',
  'role.read',
  'role.manage',
  'catalog.read',
  'catalog.manage',
  'service_point.read',
  'service_point.manage',
  'qr.manage',
  'order.read',
  'order.manage',
  'production.read',
  'production.manage',
  'cancellation.approve',
  'session.read',
  'session.withdraw_check_request',
  'session.start_closing',
  'session.close',
  'audit.read',
  'report.read',
];

export const STANDARD_ROLE_CAPABILITIES: Record<
  StandardRole,
  readonly Capability[]
> = {
  owner: CAPABILITIES,
  manager: management,
  waiter: [
    'catalog.read',
    'service_point.read',
    'order.read',
    'order.create',
    'cancellation.request',
    'session.read',
    'session.withdraw_check_request',
    'service_call.read',
    'service_call.manage',
    'bill.read',
  ],
  kitchen: ['order.read', 'production.read', 'production.manage'],
  bar: ['order.read', 'production.read', 'production.manage'],
};

export const STANDARD_ROLE_NAMES: Record<StandardRole, string> = {
  owner: 'Proprietário / administrador',
  manager: 'Gerente',
  waiter: 'Garçom / atendente',
  kitchen: 'Cozinha',
  bar: 'Bar',
};
