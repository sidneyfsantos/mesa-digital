import { Module } from '@nestjs/common';
import { QrTokenService } from '../entry-contexts/qr-token.service.js';
import { OrderController } from './order.controller.js';
import { OrderService } from './order.service.js';
@Module({
  controllers: [OrderController],
  providers: [OrderService, QrTokenService],
})
export class OrderingModule {}
