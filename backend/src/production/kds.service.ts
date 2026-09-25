import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service.js';
import {
  orderItems,
  orderStatusHistory,
  orders,
  outboxEvents,
  serviceSessions,
} from '../database/schema/index.js';
import { publishOrderEvent, publishStationEvent } from '../realtime/realtime.controller.js';

type ItemStatus = 'ACCEPTED' | 'IN_PREPARATION' | 'READY' | 'DELIVERED' | 'CANCELLED';

const STATUS_TRANSITIONS: Record<ItemStatus, ItemStatus[]> = {
  ACCEPTED: ['IN_PREPARATION', 'CANCELLED'],
  IN_PREPARATION: ['READY', 'CANCELLED'],
  READY: ['DELIVERED', 'CANCELLED'],
  DELIVERED: [],
  CANCELLED: [],
};

const TERMINAL_STATUSES = ['DELIVERED', 'CANCELLED'];

@Injectable()
export class KdsService {
  constructor(private readonly db: DatabaseService) {}

  async getStationItems(tenantId: string, stationId: string) {
    return this.db.withTenantContext(tenantId, async (tx) => {
      const items = await tx
        .select({
          id: orderItems.id,
          orderId: orderItems.orderId,
          productName: orderItems.productNameSnapshot,
          quantity: orderItems.quantity,
          status: orderItems.status,
          stationId: orderItems.stationId,
          createdAt: orderItems.createdAt,
          startedAt: orderItems.startedAt,
          readyAt: orderItems.readyAt,
          deliveredAt: orderItems.deliveredAt,
          orderReference: orders.reference,
          orderStatus: orders.status,
          serviceSessionId: orders.serviceSessionId,
          servicePointLabel: serviceSessions.servicePointId,
        })
        .from(orderItems)
        .innerJoin(
          orders,
          and(
            eq(orders.tenantId, orderItems.tenantId),
            eq(orders.id, orderItems.orderId),
          ),
        )
        .innerJoin(
          serviceSessions,
          and(
            eq(serviceSessions.tenantId, orders.tenantId),
            eq(serviceSessions.id, orders.serviceSessionId),
          ),
        )
        .where(
          and(
            eq(orderItems.tenantId, tenantId),
            eq(orderItems.stationId, stationId),
            eq(orderItems.status, 'ACCEPTED'),
          ),
        )
        .orderBy(orderItems.createdAt);

      return items;
    });
  }

  async getStationItemsAllStatuses(
    tenantId: string,
    stationId: string,
    statuses: ItemStatus[],
  ) {
    return this.db.withTenantContext(tenantId, async (tx) => {
      const items = await tx
        .select({
          id: orderItems.id,
          orderId: orderItems.orderId,
          productName: orderItems.productNameSnapshot,
          quantity: orderItems.quantity,
          status: orderItems.status,
          stationId: orderItems.stationId,
          createdAt: orderItems.createdAt,
          startedAt: orderItems.startedAt,
          readyAt: orderItems.readyAt,
          deliveredAt: orderItems.deliveredAt,
          orderReference: orders.reference,
          orderStatus: orders.status,
          serviceSessionId: orders.serviceSessionId,
        })
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
            eq(orderItems.stationId, stationId),
            sql`${orderItems.status} in (${sql.join(statuses.map((s) => sql`${s}`), sql`, `)})`,
          ),
        )
        .orderBy(
          sql`case ${orderItems.status} when 'ACCEPTED' then 1 when 'IN_PREPARATION' then 2 when 'READY' then 3 else 4 end`,
          orderItems.createdAt,
        );

      return items;
    });
  }

  async transitionItem(
    tenantId: string,
    itemId: string,
    newStatus: ItemStatus,
    _actorId: string,
  ) {
    let orderId = '';
    let stationId: string | null = null;
    let orderReference = '';
    let orderStatus = '';
    const now = new Date();

    await this.db.withTenantContext(tenantId, async (tx) => {
      const item = await tx
        .select()
        .from(orderItems)
        .where(
          and(eq(orderItems.tenantId, tenantId), eq(orderItems.id, itemId)),
        )
        .limit(1);

      if (!item[0]) throw new NotFoundException('Order item not found.');

      const currentStatus = item[0].status as ItemStatus;
      const allowed = STATUS_TRANSITIONS[currentStatus] ?? [];
      if (!allowed.includes(newStatus)) {
        throw new BadRequestException(
          `Invalid transition from ${currentStatus} to ${newStatus}`,
        );
      }

      const updates: Record<string, any> = { status: newStatus };
      if (newStatus === 'IN_PREPARATION') updates.startedAt = now;
      if (newStatus === 'READY') updates.readyAt = now;
      if (newStatus === 'DELIVERED') updates.deliveredAt = now;

      await tx
        .update(orderItems)
        .set(updates)
        .where(
          and(eq(orderItems.tenantId, tenantId), eq(orderItems.id, itemId)),
        );

      await tx.insert(orderStatusHistory).values({
        tenantId,
        orderId: item[0].orderId,
        status: newStatus,
      });

      await this.maybeUpdateOrderStatus(tx, tenantId, item[0].orderId);

      await tx.insert(outboxEvents).values({
        tenantId,
        aggregateType: 'OrderItem',
        aggregateId: itemId,
        eventType: `order_item.${newStatus.toLowerCase()}`,
        payload: { itemId, orderId: item[0].orderId, status: newStatus },
      });

      orderId = item[0].orderId;
      stationId = item[0].stationId;
    });

    const order = await this.db.withTenantContext(tenantId, async (tx) => {
      const o = await tx
        .select({ reference: orders.reference, status: orders.status })
        .from(orders)
        .where(and(eq(orders.tenantId, tenantId), eq(orders.id, orderId)))
        .limit(1);
      return o[0];
    });

    if (order) {
      orderReference = order.reference;
      orderStatus = order.status;
    }

    if (stationId) {
      publishStationEvent(tenantId, stationId, {
        type: 'item.status',
        payload: {
          itemId,
          orderId,
          orderReference,
          status: newStatus,
          timestamp: now.toISOString(),
        },
        timestamp: now.toISOString(),
      });
    }

    publishOrderEvent(tenantId, {
      type: 'order.status',
      payload: {
        orderId,
        orderReference,
        status: orderStatus,
        timestamp: now.toISOString(),
      },
      timestamp: now.toISOString(),
    });

    return { itemId, status: newStatus, timestamp: now };
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
    const allTerminal = statuses.every((s: string) => TERMINAL_STATUSES.includes(s));
    const anyInPreparation = statuses.some((s: string) => s === 'IN_PREPARATION');
    const anyReady = statuses.some((s: string) => s === 'READY');
    const allReadyOrDelivered = statuses.every((s: string) =>
      ['READY', 'DELIVERED'].includes(s),
    );

    let derivedStatus: string;
    if (allTerminal) derivedStatus = 'COMPLETED';
    else if (anyInPreparation) derivedStatus = 'IN_PRODUCTION';
    else if (anyReady && !allReadyOrDelivered) derivedStatus = 'IN_PRODUCTION';
    else if (allReadyOrDelivered) derivedStatus = 'READY';
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

  async getDeliveryItems(tenantId: string) {
    return this.db.withTenantContext(tenantId, async (tx) => {
      const items = await tx
        .select({
          id: orderItems.id,
          orderId: orderItems.orderId,
          productName: orderItems.productNameSnapshot,
          quantity: orderItems.quantity,
          status: orderItems.status,
          stationId: orderItems.stationId,
          createdAt: orderItems.createdAt,
          readyAt: orderItems.readyAt,
          orderReference: orders.reference,
          serviceSessionId: orders.serviceSessionId,
        })
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
            eq(orderItems.status, 'READY'),
          ),
        )
        .orderBy(orderItems.readyAt);

      return items;
    });
  }

  async getOrderSummary(tenantId: string, orderId: string) {
    return this.db.withTenantContext(tenantId, async (tx) => {
      const order = await tx
        .select()
        .from(orders)
        .where(
          and(eq(orders.tenantId, tenantId), eq(orders.id, orderId)),
        )
        .limit(1);

      if (!order[0]) return null;

      const items = await tx
        .select()
        .from(orderItems)
        .where(
          and(
            eq(orderItems.tenantId, tenantId),
            eq(orderItems.orderId, orderId),
          ),
        );

      return { order: order[0], items };
    });
  }
}