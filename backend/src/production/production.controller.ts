import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CapabilitiesGuard } from '../auth/capabilities.guard.js';
import type { PrincipalRequest } from '../auth/principal.js';
import { RequireCapabilities } from '../auth/require-capabilities.decorator.js';
import { ProductionService } from './production.service.js';

@Controller('admin/production')
@UseGuards(CapabilitiesGuard)
export class ProductionController {
  constructor(private readonly production: ProductionService) {}

  @Get('stations')
  @RequireCapabilities('catalog.read')
  stations(@Req() r: PrincipalRequest) {
    return this.production.listStations(r.principal!.tenantId);
  }

  @Post('stations')
  @RequireCapabilities('catalog.manage')
  stationCreate(@Req() r: PrincipalRequest, @Body() b: any) {
    return this.production.createStation(r.principal!.tenantId, b);
  }

  @Patch('stations/:id')
  @RequireCapabilities('catalog.manage')
  stationUpdate(
    @Req() r: PrincipalRequest,
    @Param('id') id: string,
    @Body() b: any,
  ) {
    return this.production.updateStation(r.principal!.tenantId, id, b);
  }

  @Delete('stations/:id')
  @RequireCapabilities('catalog.manage')
  stationDelete(@Req() r: PrincipalRequest, @Param('id') id: string) {
    return this.production.deleteStation(r.principal!.tenantId, id);
  }

  @Get('routing')
  @RequireCapabilities('catalog.read')
  routing(@Req() r: PrincipalRequest) {
    return this.production.listRouting(r.principal!.tenantId);
  }

  @Post('routing')
  @RequireCapabilities('catalog.manage')
  routingSet(@Req() r: PrincipalRequest, @Body() b: any) {
    return this.production.setRouting(
      r.principal!.tenantId,
      b.productId,
      b.stationId,
    );
  }

  @Delete('routing/:productId')
  @RequireCapabilities('catalog.manage')
  routingRemove(@Req() r: PrincipalRequest, @Param('productId') productId: string) {
    return this.production.removeRouting(r.principal!.tenantId, productId);
  }
}