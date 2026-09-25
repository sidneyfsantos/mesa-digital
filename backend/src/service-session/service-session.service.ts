import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service.js';
import {
  billRequests,
  cancellationRequests,
  orderItems,
  orders,
  orderStatusHistory,
  outboxEvents,
  serviceCalls,
  serviceSessionTotals,
  serviceSessions,
} from '../database/schema/index.js';

@Injectable()
export class ServiceSessionService {
  constructor(private readonly db: DatabaseService) {}

  // Service Calls (Chamar Garçom)
  async createServiceCall(tenantId: string, sessionId: string, actorId: string) {
    return this.db.withTenantContext(tenantId, async (tx) => {
      const session = await tx
        .select()
        .from(serviceSessions)
        .where(
          and(
            eq(serviceSessions.tenantId, tenantId),
            eq(serviceSessions.id, sessionId),
          ),
        )
        .limit(1);

      if (!session[0]) throw new NotFoundException('Service session not found.');
      if (session[0].status !== 'OPEN')
        throw new BadRequestException('Cannot call waiter on non-OPEN session.');

      const existing = await tx
        .select()
        .from(serviceCalls)
        .where(
          and(
            eq(serviceCalls.tenantId, tenantId),
            eq(serviceCalls.serviceSessionId, sessionId),
            eq(serviceCalls.status, 'PENDING'),
          ),
        )
        .limit(1);

      if (existing[0]) {
        throw new BadRequestException('Service call already pending for this session.');
      }

      const [call] = await tx
        .insert(serviceCalls)
        .values({
          tenantId,
          serviceSessionId: sessionId,
          requestedBy: actorId,
        })
        .returning();

      return { call, timestamp: new Date() };
    });
  }

  async getServiceCalls(tenantId: string, sessionId?: string) {
    return this.db.withTenantContext(tenantId, async (tx) => {
      const conditions = [eq(serviceCalls.tenantId, tenantId)];
      if (sessionId) {
        conditions.push(eq(serviceCalls.serviceSessionId, sessionId));
      }
      return tx
        .select()
        .from(serviceCalls)
        .where(and(...conditions))
        .orderBy(serviceCalls.requestedAt);
    });
  }

  async resolveServiceCall(tenantId: string, callId: string, actorId: string) {
    return this.db.withTenantContext(tenantId, async (tx) => {
      const call = await tx
        .select()
        .from(serviceCalls)
        .where(
          and(
            eq(serviceCalls.tenantId, tenantId),
            eq(serviceCalls.id, callId),
          ),
        )
        .limit(1);

      if (!call[0]) throw new NotFoundException('Service call not found.');
      if (call[0].status === 'RESOLVED')
        throw new BadRequestException('Service call already resolved.');

      await tx
        .update(serviceCalls)
        .set({ status: 'RESOLVED', resolvedAt: new Date(), resolvedBy: actorId })
        .where(
          and(
            eq(serviceCalls.tenantId, tenantId),
            eq(serviceCalls.id, callId),
          ),
        );

      return { success: true };
    });
  }

  // Bill Requests (Pedir a Conta)
  async requestBill(tenantId: string, sessionId: string, actorId: string) {
    return this.db.withTenantContext(tenantId, async (tx) => {
      const session = await tx
        .select()
        .from(serviceSessions)
        .where(
          and(
            eq(serviceSessions.tenantId, tenantId),
            eq(serviceSessions.id, sessionId),
          ),
        )
        .limit(1);

      if (!session[0]) throw new NotFoundException('Service session not found.');
      if (session[0].status === 'CLOSED')
        throw new BadRequestException('Session already closed.');
      if (session[0].status === 'CLOSING')
        throw new BadRequestException('Session is closing.');

      // Check for existing active bill request
      const existing = await tx
        .select()
        .from(billRequests)
        .where(
          and(
            eq(billRequests.tenantId, tenantId),
            eq(billRequests.serviceSessionId, sessionId),
          ),
        )
        .limit(1);

      if (existing[0]) {
        return existing[0];
      }

      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`${tenantId}:${sessionId}`},0))`,
      );

      const existingAfterLock = await tx
        .select()
        .from(billRequests)
        .where(
          and(
            eq(billRequests.tenantId, tenantId),
            eq(billRequests.serviceSessionId, sessionId),
          ),
        )
        .limit(1);

      if (existingAfterLock[0]) {
        return existingAfterLock[0];
      }

      const [billRequest] = await tx
        .insert(billRequests)
        .values({
          tenantId,
          serviceSessionId: sessionId,
          requestedBy: actorId,
        })
        .returning();

      await tx
        .update(serviceSessions)
        .set({ status: 'CHECK_REQUESTED' })
        .where(
          and(
            eq(serviceSessions.tenantId, tenantId),
            eq(serviceSessions.id, sessionId),
          ),
        );

      return { billRequest, timestamp: new Date() };
    });
  }

  async getBillRequests(tenantId: string, sessionId?: string) {
    return this.db.withTenantContext(tenantId, async (tx) => {
      const conditions = [eq(billRequests.tenantId, tenantId)];
      if (sessionId) {
        conditions.push(eq(billRequests.serviceSessionId, sessionId));
      }
      return tx
        .select()
        .from(billRequests)
        .where(and(...conditions))
        .orderBy(billRequests.requestedAt);
    });
  }

  async withdrawBillRequest(tenantId: string, sessionId: string, actorId: string) {
    return this.db.withTenantContext(tenantId, async (tx) => {
      const billRequest = await tx
        .select()
        .from(billRequests)
        .where(
          and(
            eq(billRequests.tenantId, tenantId),
            eq(billRequests.serviceSessionId, sessionId),
          ),
        )
        .limit(1);

      if (!billRequest[0]) throw new NotFoundException('Bill request not found.');
      if (billRequest[0].withdrawnAt)
        throw new BadRequestException('Bill request already withdrawn.');

      await tx
        .update(billRequests)
        .set({ withdrawnAt: new Date(), withdrawnBy: actorId })
        .where(
          and(
            eq(billRequests.tenantId, tenantId),
            eq(billRequests.serviceSessionId, sessionId),
          ),
        );

      await tx
        .update(serviceSessions)
        .set({ status: 'OPEN' })
        .where(
          and(
            eq(serviceSessions.tenantId, tenantId),
            eq(serviceSessions.id, sessionId),
          ),
        );

      return { success: true };
    });
  }

  // Cancellation Requests
  async requestCancellation(
    tenantId: string,
    itemId: string,
    actorId: string,
    reason: string,
  ) {
    if (!reason || reason.trim().length < 5) {
      throw new BadRequestException('Cancellation reason is required (min 5 chars).');
    }

    return this.db.withTenantContext(tenantId, async (tx) => {
      const item = await tx
        .select()
        .from(orderItems)
        .where(
          and(
            eq(orderItems.tenantId, tenantId),
            eq(orderItems.id, itemId),
          ),
        )
        .limit(1);

      if (!item[0]) throw new NotFoundException('Order item not found.');

      const existing = await tx
        .select()
        .from(cancellationRequests)
        .where(
          and(
            eq(cancellationRequests.tenantId, tenantId),
            eq(cancellationRequests.orderItemId, itemId),
            eq(cancellationRequests.status, 'PENDING'),
          ),
        )
        .limit(1);

      if (existing[0]) {
        throw new BadRequestException('Cancellation already pending for this item.');
      }

      const nonCancellableStates = ['DELIVERED', 'CANCELLED'];
      if (nonCancellableStates.includes(item[0].status)) {
        throw new BadRequestException(
          `Cannot cancel item in ${item[0].status} state.`,
        );
      }

      const [request] = await tx
        .insert(cancellationRequests)
        .values({
          tenantId,
          orderItemId: itemId,
          reason: reason.trim(),
          requestedBy: actorId,
        })
        .returning();

      return { request, timestamp: new Date() };
    });
  }

  async getCancellationRequests(tenantId: string) {
    return this.db.withTenantContext(tenantId, async (tx) =>
      tx
        .select()
        .from(cancellationRequests)
        .where(eq(cancellationRequests.tenantId, tenantId))
        .orderBy(cancellationRequests.requestedAt),
    );
  }

  async decideCancellation(
    tenantId: string,
    requestId: string,
    actorId: string,
    approve: boolean,
    note?: string,
  ) {
    return this.db.withTenantContext(tenantId, async (tx) => {
      const request = await tx
        .select()
        .from(cancellationRequests)
        .where(
          and(
            eq(cancellationRequests.tenantId, tenantId),
            eq(cancellationRequests.id, requestId),
          ),
        )
        .limit(1);

      if (!request[0]) throw new NotFoundException('Cancellation request not found.');
      if (request[0].status !== 'PENDING')
        throw new BadRequestException('Request already decided.');

      const item = await tx
        .select()
        .from(orderItems)
        .where(
          and(
            eq(orderItems.tenantId, tenantId),
            eq(orderItems.id, request[0].orderItemId),
          ),
        )
        .limit(1);

      if (!item[0]) throw new NotFoundException('Order item not found.');

      if (approve) {
        const nonCancellableStates = ['DELIVERED', 'CANCELLED'];
        if (nonCancellableStates.includes(item[0].status)) {
          throw new BadRequestException(
            `Cannot cancel item in ${item[0].status} state.`,
          );
        }

        const previousStatus = item[0].status;

        await tx
          .update(orderItems)
          .set({ status: 'CANCELLED' })
          .where(
            and(
              eq(orderItems.tenantId, tenantId),
              eq(orderItems.id, request[0].orderItemId),
            ),
          );

        await tx.insert(orderStatusHistory).values({
          tenantId,
          orderId: item[0].orderId,
          status: 'CANCELLED',
        });

        await this.maybeUpdateOrderStatus(tx, tenantId, item[0].orderId);

        await tx
          .update(cancellationRequests)
          .set({
            status: 'APPROVED',
            decidedBy: actorId,
            decidedAt: new Date(),
            decisionNote: note || null,
          })
          .where(
            and(
              eq(cancellationRequests.tenantId, tenantId),
              eq(cancellationRequests.id, requestId),
            ),
          );

        return { success: true, action: 'approved', previousStatus };
      } else {
        await tx
          .update(cancellationRequests)
          .set({
            status: 'REJECTED',
            decidedBy: actorId,
            decidedAt: new Date(),
            decisionNote: note || null,
          })
          .where(
            and(
              eq(cancellationRequests.tenantId, tenantId),
              eq(cancellationRequests.id, requestId),
            ),
          );

        return { success: true, action: 'rejected' };
      }
    });
  }

  private async maybeUpdateOrderStatus(
    tx: any,
    tenantId: string,
    orderId: string,
  ) {
    const items = await tx
      .select({ status: orderItems.status })
      .from(orderItems)
      .where(
        and(eq(orderItems.tenantId, tenantId), eq(orderItems.orderId, orderId)),
      );

    if (!items.length) return;

    const statuses = items.map((i: any) => i.status) as string[];
    const terminalStates = ['DELIVERED', 'CANCELLED'];
    const allTerminal = statuses.every((s: string) => terminalStates.includes(s));
    const anyInPreparation = statuses.some((s: string) => s === 'IN_PREPARATION');
    const anyReady = statuses.some((s: string) => s === 'READY');
    const allReadyOrDelivered = statuses.every((s: string) =>
      ['READY', 'DELIVERED'].includes(s),
    );

    let derivedStatus: string;
    if (allTerminal) derivedStatus = 'COMPLETED';
    else if (anyInPreparation) derivedStatus = 'IN_PRODUCTION';
    else if (anyReady && !statuses.every((s: string) => ['READY', 'DELIVERED'].includes(s)))
      derivedStatus = 'IN_PRODUCTION';
    else if (statuses.every((s: string) => ['READY', 'DELIVERED'].includes(s))) derivedStatus = 'READY';
    else derivedStatus = 'CONFIRMED';

    await tx
      .update(orders)
      .set({ status: derivedStatus })
      .where(and(eq(orders.tenantId, tenantId), eq(orders.id, orderId)));

    await tx.insert(orderStatusHistory).values({
      tenantId,
      orderId,
      status: derivedStatus,
    });
  }

  // Service Session Totals
  async getTotals(tenantId: string, sessionId: string) {
    return this.db.withTenantContext(tenantId, async (tx) => {
      const totals = await tx
        .select()
        .from(serviceSessionTotals)
        .where(
          and(
            eq(serviceSessionTotals.tenantId, tenantId),
            eq(serviceSessionTotals.serviceSessionId, sessionId),
          ),
        )
        .limit(1);

      if (totals[0]) return totals[0];

      const items = await tx
        .select()
        .from(orderItems)
        .innerJoin(
          orders,
          and(
            eq(orders.tenantId, orderItems.tenantId),
            eq(orders.id, orderItems.orderId),
          ),
        )
        .where(
          and(
            eq(orderItems.tenantId, tenantId),
            eq(orders.serviceSessionId, sessionId),
          ),
        );

      let originalTotal = 0;
      let cancelledTotal = 0;

      for (const row of items) {
        const item = row.order_items;
        originalTotal += Number(item.lineTotalMinor);
        if (item.status === 'CANCELLED') {
          cancelledTotal += Number(item.lineTotalMinor);
        }
      }

      const effectiveTotal = originalTotal - cancelledTotal;

      return {
        originalTotalMinor: originalTotal,
        cancelledTotalMinor: cancelledTotal,
        discountTotalMinor: 0,
        additionalServiceTotalMinor: 0,
        effectiveTotalMinor: effectiveTotal,
        calculated: true,
      };
    });
  }

  async materializeTotals(tenantId: string, sessionId: string) {
    return this.db.withTenantContext(tenantId, async (tx) => {
      const items = await tx
        .select()
        .from(orderItems)
        .innerJoin(
          orders,
          and(
            eq(orders.tenantId, orderItems.tenantId),
            eq(orders.id, orderItems.orderId),
          ),
        )
        .where(
          and(
            eq(orderItems.tenantId, tenantId),
            eq(orders.serviceSessionId, sessionId),
          ),
        );

      let originalTotal = 0;
      let cancelledTotal = 0;

      for (const row of items) {
        const item = row.order_items;
        originalTotal += Number(item.lineTotalMinor);
        if (item.status === 'CANCELLED') {
          cancelledTotal += Number(item.lineTotalMinor);
        }
      }

      const effectiveTotal = originalTotal - cancelledTotal;

      await tx
        .insert(serviceSessionTotals)
        .values({
          tenantId,
          serviceSessionId: sessionId,
          originalTotalMinor: originalTotal,
          cancelledTotalMinor: cancelledTotal,
          discountTotalMinor: 0,
          additionalServiceTotalMinor: 0,
          effectiveTotalMinor: effectiveTotal,
        })
        .onConflictDoUpdate({
          target: [serviceSessionTotals.tenantId, serviceSessionTotals.serviceSessionId],
          set: {
            originalTotalMinor: originalTotal,
            cancelledTotalMinor: cancelledTotal,
            effectiveTotalMinor: effectiveTotal,
            updatedAt: new Date(),
          },
        });
    });
  }

  // Session Closing
  async startClosing(tenantId: string, sessionId: string, actorId: string) {
    return this.db.withTenantContext(tenantId, async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`${tenantId}:${sessionId}`},0))`,
      );

      const session = await tx
        .select()
        .from(serviceSessions)
        .where(
          and(
            eq(serviceSessions.tenantId, tenantId),
            eq(serviceSessions.id, sessionId),
          ),
        )
        .limit(1);

      if (!session[0]) throw new NotFoundException('Service session not found.');
      if (session[0].status === 'CLOSED')
        throw new BadRequestException('Session already closed.');
      if (session[0].status === 'CLOSING')
        throw new BadRequestException('Session already closing.');

      const items = await tx
        .select({ status: orderItems.status })
        .from(orderItems)
        .innerJoin(
          orders,
          and(
            eq(orders.tenantId, orderItems.tenantId),
            eq(orders.id, orderItems.orderId),
          ),
        )
        .where(
          and(
            eq(orderItems.tenantId, tenantId),
            eq(orders.serviceSessionId, sessionId),
          ),
        );

      const nonTerminal = ['ACCEPTED', 'IN_PREPARATION', 'READY'];
      const hasActive = items.some((row) =>
        nonTerminal.includes(row.status),
      );

      if (hasActive) {
        throw new BadRequestException(
          'Cannot close: there are items not in DELIVERED or CANCELLED state.',
        );
      }

      const pendingCancels = await tx
        .select()
        .from(cancellationRequests)
        .where(
          and(
            eq(cancellationRequests.tenantId, tenantId),
            eq(cancellationRequests.status, 'PENDING'),
          ),
        );

      const sessionItemIds = new Set(
        (await tx
          .select({ id: orderItems.id })
          .from(orderItems)
          .innerJoin(
            orders,
            and(
              eq(orders.tenantId, orderItems.tenantId),
              eq(orders.id, orderItems.orderId),
            ),
          )
          .where(
            and(
              eq(orderItems.tenantId, tenantId),
              eq(orders.serviceSessionId, sessionId),
            ),
          )
        ).map((row) => row.id),
      );

      const hasPendingCancels = pendingCancels.some((cr) =>
        sessionItemIds.has(cr.orderItemId),
      );

      if (hasPendingCancels) {
        throw new BadRequestException(
          'Cannot close: there are pending cancellation requests.',
        );
      }

      await tx
        .update(serviceSessions)
        .set({ status: 'CLOSING' })
        .where(
          and(
            eq(serviceSessions.tenantId, tenantId),
            eq(serviceSessions.id, sessionId),
          ),
        );

      return { success: true };
    });
  }

  async closeSession(tenantId: string, sessionId: string, actorId: string) {
    return this.db.withTenantContext(tenantId, async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`${tenantId}:${sessionId}`},0))`,
      );

      const session = await tx
        .select()
        .from(serviceSessions)
        .where(
          and(
            eq(serviceSessions.tenantId, tenantId),
            eq(serviceSessions.id, sessionId),
          ),
        )
        .limit(1);

      if (!session[0]) throw new NotFoundException('Service session not found.');
      if (session[0].status === 'CLOSED')
        throw new BadRequestException('Session already closed.');

      const items = await tx
        .select({ status: orderItems.status })
        .from(orderItems)
        .innerJoin(
          orders,
          and(
            eq(orders.tenantId, orderItems.tenantId),
            eq(orders.id, orderItems.orderId),
          ),
        )
        .where(
          and(
            eq(orderItems.tenantId, tenantId),
            eq(orders.serviceSessionId, sessionId),
          ),
        );

      const nonTerminal = ['ACCEPTED', 'IN_PREPARATION', 'READY'];
      const hasActive = items.some((row) =>
        nonTerminal.includes(row.status),
      );

      if (hasActive) {
        throw new BadRequestException(
          'Cannot close: there are items not in DELIVERED or CANCELLED state.',
        );
      }

      const pendingCancels = await tx
        .select()
        .from(cancellationRequests)
        .where(
          and(
            eq(cancellationRequests.tenantId, tenantId),
            eq(cancellationRequests.status, 'PENDING'),
          ),
        );

      const sessionItemIds = new Set(
        (await tx
          .select({ id: orderItems.id })
          .from(orderItems)
          .innerJoin(
            orders,
            and(
              eq(orders.tenantId, orderItems.tenantId),
              eq(orders.id, orderItems.orderId),
            ),
          )
          .where(
            and(
              eq(orderItems.tenantId, tenantId),
              eq(orders.serviceSessionId, sessionId),
            ),
          )
        ).map((row) => row.id),
      );

      const hasPendingCancels = pendingCancels.some((cr) =>
        sessionItemIds.has(cr.orderItemId),
      );

      if (hasPendingCancels) {
        throw new BadRequestException(
          'Cannot close: there are pending cancellation requests.',
        );
      }

      await tx
        .update(serviceSessions)
        .set({ status: 'CLOSED', closedAt: new Date() })
        .where(
          and(
            eq(serviceSessions.tenantId, tenantId),
            eq(serviceSessions.id, sessionId),
          ),
        );

      return { success: true };
    });
  }

  // Get session with all related data for operacional view
  async getSessionDetails(tenantId: string, sessionId: string) {
    return this.db.withTenantContext(tenantId, async (tx) => {
      const session = await tx
        .select()
        .from(serviceSessions)
        .where(
          and(
            eq(serviceSessions.tenantId, tenantId),
            eq(serviceSessions.id, sessionId),
          ),
        )
        .limit(1);

      if (!session[0]) return null;

      const ordersData = await tx
        .select()
        .from(orders)
        .where(
          and(
            eq(orders.tenantId, tenantId),
            eq(orders.serviceSessionId, sessionId),
          ),
        );

      const items = await tx
        .select()
        .from(orderItems)
        .innerJoin(
          orders,
          and(
            eq(orders.tenantId, orderItems.tenantId),
            eq(orders.id, orderItems.orderId),
          ),
        )
        .where(
          and(
            eq(orderItems.tenantId, tenantId),
            eq(orders.serviceSessionId, sessionId),
          ),
        );

      const serviceCallsData = await tx
        .select()
        .from(serviceCalls)
        .where(
          and(
            eq(serviceCalls.tenantId, tenantId),
            eq(serviceCalls.serviceSessionId, sessionId),
          ),
        );

      const billRequestsData = await tx
        .select()
        .from(billRequests)
        .where(
          and(
            eq(billRequests.tenantId, tenantId),
            eq(billRequests.serviceSessionId, sessionId),
          ),
        );

      const cancellationRequestsData = await tx
        .select()
        .from(cancellationRequests)
        .where(eq(cancellationRequests.tenantId, tenantId));

      const sessionItemIds = new Set(
        items.map((row) => row.order_items.id),
      );
      const sessionCancels = cancellationRequestsData.filter((cr) =>
        sessionItemIds.has(cr.orderItemId),
      );

      const totals = await this.getTotals(tenantId, sessionId);

      return {
        session: session[0],
        orders: ordersData,
        items: items.map((row) => row.order_items),
        serviceCalls: serviceCallsData,
        billRequests: billRequestsData,
        cancellations: sessionCancels,
        totals,
      };
    });
  }
}