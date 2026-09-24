import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Req, UseGuards } from '@nestjs/common';
import { CapabilitiesGuard } from '../auth/capabilities.guard.js';
import type { PrincipalRequest } from '../auth/principal.js';
import { RequireCapabilities } from '../auth/require-capabilities.decorator.js';
import { EntryCredentialService } from './entry-credential.service.js';
import { EntryModeService } from './entry-mode.service.js';
import { ServicePointService } from './service-point.service.js';
import type { ServicePointInput, ServicePointUpdate } from './service-point.service.js';
import type { ServicePointKind } from '../database/repositories/service-point.repository.js';
@Controller('admin/entry-contexts')
@UseGuards(CapabilitiesGuard)
export class ServicePointsController {
  constructor(private readonly servicePoints: ServicePointService, private readonly credentials: EntryCredentialService, private readonly modes: EntryModeService) {}
  @Get('modes') @RequireCapabilities('service_point.read') modesGet(@Req() request: PrincipalRequest) { return this.modes.get(request.principal!.tenantId); }
  @Put('modes') @RequireCapabilities('service_point.manage') modesReplace(@Req() request: PrincipalRequest, @Body() body: { enabledServicePointKinds: ServicePointKind[] }) { return this.modes.replace(request.principal!.tenantId, body); }
  @Get('service-points') @RequireCapabilities('service_point.read') list(@Req() request: PrincipalRequest) { return this.servicePoints.list(request.principal!.tenantId); }
  @Post('service-points') @RequireCapabilities('service_point.manage') create(@Req() request: PrincipalRequest, @Body() body: ServicePointInput) { return this.servicePoints.create(request.principal!.tenantId, body); }
  @Patch('service-points/:servicePointId') @RequireCapabilities('service_point.manage') update(@Req() request: PrincipalRequest, @Param('servicePointId') id: string, @Body() body: ServicePointUpdate) { return this.servicePoints.update(request.principal!.tenantId, id, body); }
  @Patch('service-points/:servicePointId/active') @RequireCapabilities('service_point.manage') setActive(@Req() request: PrincipalRequest, @Param('servicePointId') id: string, @Body() body: { active: boolean }) { return this.servicePoints.setActive(request.principal!.tenantId, id, body.active); }
  @Post('service-points/:servicePointId/qr') @RequireCapabilities('qr.manage') issueQr(@Req() request: PrincipalRequest, @Param('servicePointId') id: string) { return this.credentials.issue(request.principal!.tenantId, id); }
  @Post('service-points/:servicePointId/qr/regenerate') @RequireCapabilities('qr.manage') regenerateQr(@Req() request: PrincipalRequest, @Param('servicePointId') id: string) { return this.credentials.regenerate(request.principal!.tenantId, id); }
  @Delete('service-points/:servicePointId/qr') @RequireCapabilities('qr.manage') async revokeQr(@Req() request: PrincipalRequest, @Param('servicePointId') id: string) { await this.credentials.revoke(request.principal!.tenantId, id); return { revoked: true }; }
  @Get('service-points/:servicePointId/qr') @RequireCapabilities('service_point.read') qrHistory(@Req() request: PrincipalRequest, @Param('servicePointId') id: string) { return this.credentials.history(request.principal!.tenantId, id); }
}
