import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthenticationService } from './authentication.service.js';
import { PasswordService } from './password.service.js';
import { PrincipalMiddleware } from './principal.middleware.js';
import { LoginRateLimitService } from './login-rate-limit.service.js';
import { AuthorizationBootstrapService } from './authorization-bootstrap.service.js';
import { AuthorizationService } from './authorization.service.js';
import { CapabilitiesGuard } from './capabilities.guard.js';

@Module({
  controllers: [AuthController],
  providers: [
    AuthorizationService,
    AuthorizationBootstrapService,
    CapabilitiesGuard,
    AuthenticationService,
    PasswordService,
    PrincipalMiddleware,
    LoginRateLimitService,
  ],
  exports: [
    AuthorizationService,
    AuthorizationBootstrapService,
    CapabilitiesGuard,
  ],
})
export class AuthModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(PrincipalMiddleware).forRoutes('*');
  }
}
