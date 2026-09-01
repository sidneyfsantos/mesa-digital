import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthorizationService } from './authorization.service.js';
import { Capability } from './capabilities.js';
import { PrincipalRequest } from './principal.js';
import { REQUIRED_CAPABILITIES } from './require-capabilities.decorator.js';

@Injectable()
export class CapabilitiesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authorization: AuthorizationService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const required =
      this.reflector.getAllAndOverride<Capability[]>(REQUIRED_CAPABILITIES, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];
    const request = context.switchToHttp().getRequest<PrincipalRequest>();
    if (!request.principal)
      throw new UnauthorizedException('Authenticated principal is required.');
    if (!this.authorization.hasAll(request.principal, required))
      throw new ForbiddenException('Required capability is missing.');
    return true;
  }
}
