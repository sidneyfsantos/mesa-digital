import { AuthorizationService } from './authorization.service.js';
import { Principal } from './principal.js';

const principal = (capabilities: Principal['capabilities']): Principal => ({
  userId: '00000000-0000-4000-8000-000000000001',
  tenantId: '00000000-0000-4000-8000-000000000002',
  tenantUserId: '00000000-0000-4000-8000-000000000003',
  capabilities,
});

describe('AuthorizationService', () => {
  const service = new AuthorizationService();

  it('allows a principal with every required capability', () => {
    expect(
      service.hasAll(principal(new Set(['order.read', 'order.create'])), [
        'order.create',
      ]),
    ).toBe(true);
  });

  it('denies a principal without a required capability', () => {
    expect(
      service.hasAll(principal(new Set(['order.read'])), ['order.create']),
    ).toBe(false);
  });
});
