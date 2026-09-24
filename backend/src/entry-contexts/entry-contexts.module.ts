import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { EntryCredentialService } from './entry-credential.service.js';
import { EntryModeService } from './entry-mode.service.js';
import { PublicEntryController } from './public-entry.controller.js';
import { QrTokenService } from './qr-token.service.js';
import { ServicePointService } from './service-point.service.js';
import { ServicePointsController } from './service-points.controller.js';
@Module({ imports: [AuthModule], controllers: [ServicePointsController, PublicEntryController], providers: [ServicePointService, EntryModeService, EntryCredentialService, QrTokenService] })
export class EntryContextsModule {}
