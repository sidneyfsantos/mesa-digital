import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CapabilitiesGuard } from '../auth/capabilities.guard.js';
import type { PrincipalRequest } from '../auth/principal.js';
import { RequireCapabilities } from '../auth/require-capabilities.decorator.js';
import { KdsService } from './kds.service.js';

@Controller('production')
@UseGuards(CapabilitiesGuard)
export class KdsController {
  constructor(private readonly kds: KdsService) {}

  @Get('stations/:stationId/items')
  @RequireCapabilities('production.read')
  stationItems(
    @Req() r: PrincipalRequest,
    @Param('stationId') stationId: string,
    @Query('status') status?: string,
  ) {
    const statuses = status
      ? (status.split(',') as any[])
      : ['ACCEPTED', 'IN_PREPARATION', 'READY'];
    return this.kds.getStationItemsAllStatuses(
      r.principal!.tenantId,
      stationId,
      statuses,
    );
  }

  @Get('stations/:stationId/active')
  @RequireCapabilities('production.read')
  stationActive(@Req() r: PrincipalRequest, @Param('stationId') stationId: string) {
    return this.kds.getStationItems(r.principal!.tenantId, stationId);
  }

  @Patch('items/:itemId/status')
  @RequireCapabilities('production.manage')
  async transitionItem(
    @Req() r: PrincipalRequest,
    @Param('itemId') itemId: string,
    @Body() b: { status: string },
  ) {
    return this.kds.transitionItem(
      r.principal!.tenantId,
      itemId,
      b.status as any,
      r.principal!.userId,
    );
  }

  @Get('delivery/ready')
  @RequireCapabilities('order.read')
  deliveryReady(@Req() r: PrincipalRequest) {
    return this.kds.getDeliveryItems(r.principal!.tenantId);
  }

  @Get('orders/:orderId')
  @RequireCapabilities('order.read')
  orderSummary(@Req() r: PrincipalRequest, @Param('orderId') orderId: string) {
    return this.kds.getOrderSummary(r.principal!.tenantId, orderId);
  }
}