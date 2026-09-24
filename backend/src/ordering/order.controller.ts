import { Body, Controller, Headers, Param, Post } from '@nestjs/common';
import { OrderService } from './order.service.js';
@Controller('public/entry')
export class OrderController {
  constructor(private orders: OrderService) {}
  @Post(':token/orders') create(
    @Param('token') token: string,
    @Headers('idempotency-key') key: string,
    @Body() body: any,
  ) {
    return this.orders.create(token, key, body);
  }
}
