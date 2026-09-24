import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { QrTokenService } from '../entry-contexts/qr-token.service.js';
import { CatalogController } from './catalog.controller.js';
import { CatalogService } from './catalog.service.js';
import { MediaService } from './media.service.js';
import { PublicCatalogController } from './public-catalog.controller.js';
import { PublicCatalogService } from './public-catalog.service.js';
@Module({
  imports: [AuthModule],
  controllers: [CatalogController, PublicCatalogController],
  providers: [
    CatalogService,
    PublicCatalogService,
    MediaService,
    QrTokenService,
  ],
})
export class CatalogModule {}
