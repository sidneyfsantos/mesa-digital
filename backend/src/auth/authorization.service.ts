import { Injectable } from '@nestjs/common';
import { Capability } from './capabilities.js';
import { Principal } from './principal.js';

@Injectable()
export class AuthorizationService {
  hasAll(principal: Principal, required: readonly Capability[]): boolean {
    return required.every((capability) =>
      principal.capabilities.has(capability),
    );
  }

  hasAny(principal: Principal, accepted: readonly Capability[]): boolean {
    return accepted.some((capability) =>
      principal.capabilities.has(capability),
    );
  }
}
