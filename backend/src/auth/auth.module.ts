import { Module } from '@nestjs/common';
import { AuthorizationBootstrapService } from './authorization-bootstrap.service.js';
import { AuthorizationService } from './authorization.service.js';
import { CapabilitiesGuard } from './capabilities.guard.js';

@Module({
  providers: [
    AuthorizationService,
    AuthorizationBootstrapService,
    CapabilitiesGuard,
  ],
  exports: [
    AuthorizationService,
    AuthorizationBootstrapService,
    CapabilitiesGuard,
  ],
})
export class AuthModule {}
