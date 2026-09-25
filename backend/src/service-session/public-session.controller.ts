import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { QrTokenService } from '../entry-contexts/qr-token.service.js';
import { ServiceSessionService } from './service-session.service.js';
import { QR_TOKEN_PATTERN } from '../entry-contexts/qr-token.service.js';
import { and, eq, sql } from 'drizzle-orm';
import { serviceSessions } from '../database/schema/index.js';

@Controller('public/entry')
export class PublicSessionController {
  constructor(
    private readonly sessions: ServiceSessionService,
    private readonly tokens: QrTokenService,
  ) {}

  @Post(':token/calls')
  async createCall(@Param('token') token: string) {
    if (!QR_TOKEN_PATTERN.test(token))
      throw new BadRequestException('Invalid token.');
    const scope = await this.resolveScope(token);
    if (!scope.sessionId) throw new BadRequestException('No active session.');
    return this.sessions.createServiceCall(
      scope.tenantId,
      scope.sessionId,
      'public-client',
    );
  }

  @Get(':token/calls')
  async getCalls(@Param('token') token: string) {
    if (!QR_TOKEN_PATTERN.test(token))
      throw new BadRequestException('Invalid token.');
    const scope = await this.resolveScope(token);
    if (!scope.sessionId) return [];
    return this.sessions.getServiceCalls(scope.tenantId, scope.sessionId);
  }

  @Post(':token/bill-request')
  async requestBill(@Param('token') token: string) {
    if (!QR_TOKEN_PATTERN.test(token))
      throw new BadRequestException('Invalid token.');
    const scope = await this.resolveScope(token);
    if (!scope.sessionId) throw new BadRequestException('No active session.');
    return this.sessions.requestBill(
      scope.tenantId,
      scope.sessionId,
      'public-client',
    );
  }

  @Get(':token/bill-request')
  async getBillRequest(@Param('token') token: string) {
    if (!QR_TOKEN_PATTERN.test(token))
      throw new BadRequestException('Invalid token.');
    const scope = await this.resolveScope(token);
    if (!scope.sessionId) return null;
    const requests = await this.sessions.getBillRequests(
      scope.tenantId,
      scope.sessionId,
    );
    return requests[0] ?? null;
  }

  @Patch(':token/bill-request/withdraw')
  async withdrawBillRequest(@Param('token') token: string) {
    if (!QR_TOKEN_PATTERN.test(token))
      throw new BadRequestException('Invalid token.');
    const scope = await this.resolveScope(token);
    if (!scope.sessionId) throw new BadRequestException('No active session.');
    return this.sessions.withdrawBillRequest(
      scope.tenantId,
      scope.sessionId,
      'public-client',
    );
  }

  @Get(':token/session')
  async getSession(@Param('token') token: string) {
    if (!QR_TOKEN_PATTERN.test(token))
      throw new BadRequestException('Invalid token.');
    const scope = await this.resolveScope(token);
    if (!scope.sessionId) {
      return { session: null, orders: [], items: [], serviceCalls: [], billRequests: [], cancellations: [], totals: null };
    }
    return this.sessions.getSessionDetails(scope.tenantId, scope.sessionId);
  }

  @Get(':token/totals')
  async getTotals(@Param('token') token: string) {
    if (!QR_TOKEN_PATTERN.test(token))
      throw new BadRequestException('Invalid token.');
    const scope = await this.resolveScope(token);
    if (!scope.sessionId) {
      return { originalTotalMinor: 0, cancelledTotalMinor: 0, discountTotalMinor: 0, additionalServiceTotalMinor: 0, effectiveTotalMinor: 0, calculated: true };
    }
    return this.sessions.getTotals(scope.tenantId, scope.sessionId);
  }

  private async resolveScope(token: string) {
    const hash = this.tokens.hash(token);
    const context = await this.sessions['db'].transaction(async (tx) => {
      const result = await tx.execute<any>(sql`select * from resolve_public_catalog_scope(${hash})`);
      return result.rows[0];
    });
    if (!context) throw new BadRequestException('Entry not found.');

    const session = await this.sessions['db'].withTenantContext(
      context.tenant_id,
      async (tx) => {
        const sessions = await tx
          .select()
          .from(serviceSessions)
          .where(
            and(
              eq(serviceSessions.tenantId, context.tenant_id),
              eq(serviceSessions.servicePointId, context.service_point_id),
              eq(serviceSessions.status, 'OPEN'),
            ),
          )
          .limit(1);
        return sessions[0];
      },
    );

    return { tenantId: context.tenant_id, sessionId: session?.id ?? null };
  }
}