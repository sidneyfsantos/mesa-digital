import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ProductionController } from './production.controller.js';
import { ProductionService } from './production.service.js';
import { KdsController } from './kds.controller.js';
import { KdsService } from './kds.service.js';

@Module({
  imports: [AuthModule],
  controllers: [ProductionController, KdsController],
  providers: [ProductionService, KdsService],
  exports: [ProductionService, KdsService],
})
export class ProductionModule {}