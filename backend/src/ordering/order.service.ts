import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service.js';
import { CatalogRepository } from '../database/repositories/catalog.repository.js';
import {
  orderItemModifiers,
  orderItems,
  orders,
  orderStatusHistory,
  outboxEvents,
  serviceSessions,
} from '../database/schema/index.js';
import {
  QR_TOKEN_PATTERN,
  QrTokenService,
} from '../entry-contexts/qr-token.service.js';
type RequestItem = {
  productId: string;
  quantity: number;
  modifierOptionIds: string[];
};
@Injectable()
export class OrderService {
  constructor(
    private db: DatabaseService,
    private catalog: CatalogRepository,
    private tokens: QrTokenService,
  ) {}
  async create(token: string, key: string, input: { items?: RequestItem[] }) {
    if (!QR_TOKEN_PATTERN.test(token) || !key || key.length > 100)
      throw new BadRequestException('Invalid order request.');
    const items = input.items;
    if (!Array.isArray(items) || items.length < 1 || items.length > 50)
      throw new BadRequestException('Order needs items.');
    for (const item of items)
      if (
        !item ||
        typeof item.productId !== 'string' ||
        !Number.isInteger(item.quantity) ||
        item.quantity < 1 ||
        item.quantity > 99 ||
        !Array.isArray(item.modifierOptionIds) ||
        new Set(item.modifierOptionIds).size !== item.modifierOptionIds.length
      )
        throw new BadRequestException('Invalid order item.');
    const canonical = JSON.stringify(
      items.map((i) => ({
        ...i,
        modifierOptionIds: [...i.modifierOptionIds].sort(),
      })),
    );
    const payloadHash = createHash('sha256').update(canonical).digest('hex');
    return this.db.transaction(async (tx) => {
      const scope = await this.catalog.resolveScope(
        tx,
        this.tokens.hash(token),
      );
      if (!scope) throw new NotFoundException('Entry not found.');
      await tx.execute(
        sql`select set_config('app.current_tenant_id',${scope.tenant_id},true)`,
      );
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`${scope.tenant_id}:${scope.service_point_id}`},0))`,
      );
      const prior = await tx
        .select()
        .from(orders)
        .where(
          and(
            eq(orders.tenantId, scope.tenant_id),
            eq(orders.idempotencyKey, key),
          ),
        )
        .limit(1);
      if (prior[0]) {
        if (prior[0].payloadHash !== payloadHash)
          throw new ConflictException('Idempotency key already used.');
        return this.result(tx, scope.tenant_id, prior[0]);
      }
      const data = await this.catalog.publicCatalog(tx, scope.tenant_id);
      const priced = [] as {
        product: any;
        quantity: number;
        mods: any[];
        unit: number;
        line: number;
      }[];
      for (const requested of items) {
        const product = data.products.find((p) => p.id === requested.productId);
        if (!product || !product.active || !product.available)
          throw new ConflictException('Product unavailable.');
        const links = data.links.filter((l) => l.productId === product.id);
        const groups = links
          .map((l) => data.groups.find((g) => g.id === l.modifierGroupId))
          .filter(Boolean) as any[];
        const selected = data.options.filter((o) =>
          requested.modifierOptionIds.includes(o.id),
        );
        if (
          selected.length !== requested.modifierOptionIds.length ||
          selected.some((o) => !groups.some((g) => g.id === o.groupId))
        )
          throw new BadRequestException('Invalid modifiers.');
        for (const group of groups) {
          const count = selected.filter((o) => o.groupId === group.id).length;
          if (count < group.minSelections || count > group.maxSelections)
            throw new BadRequestException('Invalid modifier selection count.');
        }
        const unit =
          product.priceMinor +
          selected.reduce((n, o) => n + o.priceDeltaMinor, 0);
        priced.push({
          product,
          quantity: requested.quantity,
          mods: selected,
          unit,
          line: unit * requested.quantity,
        });
      }
      let session = (
        await tx
          .select()
          .from(serviceSessions)
          .where(
            and(
              eq(serviceSessions.tenantId, scope.tenant_id),
              eq(serviceSessions.servicePointId, scope.service_point_id),
              eq(serviceSessions.status, 'OPEN'),
            ),
          )
          .limit(1)
      )[0];
      if (!session)
        session = (
          await tx
            .insert(serviceSessions)
            .values({
              tenantId: scope.tenant_id,
              servicePointId: scope.service_point_id,
              entryCredentialId: scope.credential_id,
            })
            .returning()
        )[0];
      const total = priced.reduce((n, i) => n + i.line, 0);
      const order = (
        await tx
          .insert(orders)
          .values({
            tenantId: scope.tenant_id,
            serviceSessionId: session.id,
            reference: randomUUID().slice(0, 8).toUpperCase(),
            idempotencyKey: key,
            payloadHash,
            totalMinor: total,
          })
          .returning()
      )[0];
      for (const item of priced) {
        const row = (
          await tx
            .insert(orderItems)
            .values({
              tenantId: scope.tenant_id,
              orderId: order.id,
              productId: item.product.id,
              quantity: item.quantity,
              productNameSnapshot: item.product.name,
              unitPriceMinor: item.product.priceMinor,
              modifiersTotalMinor: item.unit - item.product.priceMinor,
              lineTotalMinor: item.line,
            })
            .returning()
        )[0];
        for (const option of item.mods) {
          const group = data.groups.find((g) => g.id === option.groupId)!;
          await tx
            .insert(orderItemModifiers)
            .values({
              tenantId: scope.tenant_id,
              orderItemId: row.id,
              modifierGroupId: group.id,
              modifierOptionId: option.id,
              groupNameSnapshot: group.name,
              optionNameSnapshot: option.name,
              priceDeltaMinor: option.priceDeltaMinor,
            });
        }
      }
      await tx
        .insert(orderStatusHistory)
        .values({
          tenantId: scope.tenant_id,
          orderId: order.id,
          status: 'ACCEPTED',
        });
      await tx
        .insert(outboxEvents)
        .values({
          tenantId: scope.tenant_id,
          aggregateType: 'Order',
          aggregateId: order.id,
          eventType: 'order.accepted',
          payload: { orderId: order.id, serviceSessionId: session.id },
        });
      return this.result(tx, scope.tenant_id, order);
    });
  }
  private async result(tx: any, tenantId: string, order: any) {
    const items = await tx
      .select()
      .from(orderItems)
      .where(
        and(
          eq(orderItems.tenantId, tenantId),
          eq(orderItems.orderId, order.id),
        ),
      );
    return {
      order: {
        id: order.id,
        reference: order.reference,
        status: order.status,
        totalMinor: order.totalMinor,
        createdAt: order.createdAt,
        items: items.map((i: any) => ({
          id: i.id,
          name: i.productNameSnapshot,
          quantity: i.quantity,
          unitPriceMinor: i.unitPriceMinor,
          modifiersTotalMinor: i.modifiersTotalMinor,
          lineTotalMinor: i.lineTotalMinor,
          status: i.status,
        })),
      },
    };
  }
}
