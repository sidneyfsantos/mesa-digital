import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthorizationService } from './authorization.service.js';
import { CapabilitiesGuard } from './capabilities.guard.js';
import { Principal } from './principal.js';

const contextFor = (principal?: Principal) =>
  ({
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
    switchToHttp: () => ({ getRequest: () => ({ principal }) }),
  }) as unknown as ExecutionContext;

describe('CapabilitiesGuard', () => {
  const reflector = {
    getAllAndOverride: () => ['order.manage'],
  } as unknown as Reflector;
  const guard = new CapabilitiesGuard(reflector, new AuthorizationService());
  const base = {
    userId: '00000000-0000-4000-8000-000000000001',
    tenantId: '00000000-0000-4000-8000-000000000002',
    tenantUserId: '00000000-0000-4000-8000-000000000003',
  };

  it('blocks requests without an authenticated principal', () => {
    expect(() => guard.canActivate(contextFor())).toThrow(
      UnauthorizedException,
    );
  });

  it('blocks principals without the required capability', () => {
    expect(() =>
      guard.canActivate(
        contextFor({ ...base, capabilities: new Set(['order.read']) }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('allows principals with the required capability', () => {
    expect(
      guard.canActivate(
        contextFor({ ...base, capabilities: new Set(['order.manage']) }),
      ),
    ).toBe(true);
  });
});
