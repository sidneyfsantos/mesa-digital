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
import { TableQrService } from './table-qr.service.js';
import { TableService } from './table.service.js';
import type { TableInput, TableUpdate } from './table.service.js';

@Controller('admin/tables')
@UseGuards(CapabilitiesGuard)
export class TablesController {
  constructor(
    private readonly tables: TableService,
    private readonly qr: TableQrService,
  ) {}
  @Get() @RequireCapabilities('table.read') list(
    @Req() request: PrincipalRequest,
  ) {
    return this.tables.list(request.principal!.tenantId);
  }
  @Post() @RequireCapabilities('table.manage') create(
    @Req() request: PrincipalRequest,
    @Body() body: TableInput,
  ) {
    return this.tables.create(request.principal!.tenantId, body);
  }
  @Patch(':tableId') @RequireCapabilities('table.manage') update(
    @Req() request: PrincipalRequest,
    @Param('tableId') tableId: string,
    @Body() body: TableUpdate,
  ) {
    return this.tables.update(request.principal!.tenantId, tableId, body);
  }
  @Patch(':tableId/active') @RequireCapabilities('table.manage') setActive(
    @Req() request: PrincipalRequest,
    @Param('tableId') tableId: string,
    @Body() body: { active: boolean },
  ) {
    return this.tables.setActive(
      request.principal!.tenantId,
      tableId,
      body.active,
    );
  }
  @Post(':tableId/qr') @RequireCapabilities('qr.manage') issueQr(
    @Req() request: PrincipalRequest,
    @Param('tableId') tableId: string,
  ) {
    return this.qr.issue(request.principal!.tenantId, tableId);
  }
  @Post(':tableId/qr/regenerate')
  @RequireCapabilities('qr.manage')
  regenerateQr(
    @Req() request: PrincipalRequest,
    @Param('tableId') tableId: string,
  ) {
    return this.qr.regenerate(request.principal!.tenantId, tableId);
  }
  @Delete(':tableId/qr') @RequireCapabilities('qr.manage') async revokeQr(
    @Req() request: PrincipalRequest,
    @Param('tableId') tableId: string,
  ) {
    await this.qr.revoke(request.principal!.tenantId, tableId);
    return { revoked: true };
  }
  @Get(':tableId/qr') @RequireCapabilities('table.read') qrHistory(
    @Req() request: PrincipalRequest,
    @Param('tableId') tableId: string,
  ) {
    return this.qr.history(request.principal!.tenantId, tableId);
  }
}
