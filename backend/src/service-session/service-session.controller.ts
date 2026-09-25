import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CapabilitiesGuard } from '../auth/capabilities.guard.js';
import type { PrincipalRequest } from '../auth/principal.js';
import { RequireCapabilities } from '../auth/require-capabilities.decorator.js';
import { ServiceSessionService } from './service-session.service.js';

@Controller('service-sessions')
@UseGuards(CapabilitiesGuard)
export class ServiceSessionController {
  constructor(private readonly service: ServiceSessionService) {}

  // Service Calls
  @Post(':sessionId/calls')
  @RequireCapabilities('service_call.create')
  async createCall(
    @Req() r: PrincipalRequest,
    @Param('sessionId') sessionId: string,
  ) {
    return this.service.createServiceCall(
      r.principal!.tenantId,
      sessionId,
      r.principal!.userId,
    );
  }

  @Get(':sessionId/calls')
  @RequireCapabilities('service_call.read')
  async getCalls(
    @Req() r: PrincipalRequest,
    @Param('sessionId') sessionId: string,
  ) {
    return this.service.getServiceCalls(r.principal!.tenantId, sessionId);
  }

  @Get('calls')
  @RequireCapabilities('service_call.read')
  async getAllCalls(
    @Req() r: PrincipalRequest,
    @Query('sessionId') sessionId?: string,
  ) {
    return this.service.getServiceCalls(r.principal!.tenantId, sessionId);
  }

  @Patch('calls/:callId/resolve')
  @RequireCapabilities('service_call.manage')
  async resolveCall(
    @Req() r: PrincipalRequest,
    @Param('callId') callId: string,
  ) {
    return this.service.resolveServiceCall(
      r.principal!.tenantId,
      callId,
      r.principal!.userId,
    );
  }

  // Bill Requests
  @Post(':sessionId/bill-request')
  @RequireCapabilities('order.create') // Client can request bill
  async requestBill(
    @Req() r: PrincipalRequest,
    @Param('sessionId') sessionId: string,
  ) {
    // For public client, we need to get tenant from session
    // This endpoint is for authenticated users (garçom) requesting bill on behalf
    return this.service.requestBill(
      r.principal!.tenantId,
      sessionId,
      r.principal!.userId,
    );
  }

  @Get(':sessionId/bill-request')
  @RequireCapabilities('bill.read')
  async getBillRequest(
    @Req() r: PrincipalRequest,
    @Param('sessionId') sessionId: string,
  ) {
    return this.service.getBillRequests(r.principal!.tenantId, sessionId);
  }

  @Get('bill-requests')
  @RequireCapabilities('bill.read')
  async getAllBillRequests(
    @Req() r: PrincipalRequest,
    @Query('sessionId') sessionId?: string,
  ) {
    return this.service.getBillRequests(r.principal!.tenantId, sessionId);
  }

  @Patch(':sessionId/bill-request/withdraw')
  @RequireCapabilities('session.withdraw_check_request')
  async withdrawBillRequest(
    @Req() r: PrincipalRequest,
    @Param('sessionId') sessionId: string,
  ) {
    return this.service.withdrawBillRequest(
      r.principal!.tenantId,
      sessionId,
      r.principal!.userId,
    );
  }

  // Cancellation Requests
  @Post('cancellation-requests')
  @RequireCapabilities('cancellation.request')
  async requestCancellation(
    @Req() r: PrincipalRequest,
    @Body() body: { itemId: string; reason: string },
  ) {
    return this.service.requestCancellation(
      r.principal!.tenantId,
      body.itemId,
      r.principal!.userId,
      body.reason,
    );
  }

  @Get('cancellation-requests')
  @RequireCapabilities('cancellation.request')
  async getCancellationRequests(@Req() r: PrincipalRequest) {
    return this.service.getCancellationRequests(r.principal!.tenantId);
  }

  @Patch('cancellation-requests/:requestId/decide')
  @RequireCapabilities('cancellation.approve')
  async decideCancellation(
    @Req() r: PrincipalRequest,
    @Param('requestId') requestId: string,
    @Body() body: { approve: boolean; note?: string },
  ) {
    return this.service.decideCancellation(
      r.principal!.tenantId,
      requestId,
      r.principal!.userId,
      body.approve,
      body.note,
    );
  }

  // Totals
  @Get(':sessionId/totals')
  @RequireCapabilities('bill.read')
  async getTotals(
    @Req() r: PrincipalRequest,
    @Param('sessionId') sessionId: string,
  ) {
    return this.service.getTotals(r.principal!.tenantId, sessionId);
  }

  // Session Closing
  @Patch(':sessionId/start-closing')
  @RequireCapabilities('session.start_closing')
  async startClosing(
    @Req() r: PrincipalRequest,
    @Param('sessionId') sessionId: string,
  ) {
    return this.service.startClosing(
      r.principal!.tenantId,
      sessionId,
      r.principal!.userId,
    );
  }

  @Patch(':sessionId/close')
  @RequireCapabilities('session.close')
  async closeSession(
    @Req() r: PrincipalRequest,
    @Param('sessionId') sessionId: string,
  ) {
    return this.service.closeSession(
      r.principal!.tenantId,
      sessionId,
      r.principal!.userId,
    );
  }

  // Session Details
  @Get(':sessionId')
  @RequireCapabilities('session.read')
  async getSessionDetails(
    @Req() r: PrincipalRequest,
    @Param('sessionId') sessionId: string,
  ) {
    return this.service.getSessionDetails(r.principal!.tenantId, sessionId);
  }
}