import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { QrTokenService } from '../entry-contexts/qr-token.service.js';
import { ServiceSessionController } from './service-session.controller.js';
import { PublicSessionController } from './public-session.controller.js';
import { ServiceSessionService } from './service-session.service.js';

@Module({
  imports: [AuthModule],
  controllers: [ServiceSessionController, PublicSessionController],
  providers: [ServiceSessionService, QrTokenService],
  exports: [ServiceSessionService],
})
export class ServiceSessionModule {}