import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service.js';
import {
  productionStations,
  productRouting,
  catalogProducts,
} from '../database/schema/index.js';

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const KINDS = ['KITCHEN', 'BAR', 'OTHER'] as const;

@Injectable()
export class ProductionService {
  constructor(private readonly db: DatabaseService) {}

  listStations(tenantId: string) {
    return this.db.withTenantContext(tenantId, (tx) =>
      tx
        .select()
        .from(productionStations)
        .where(eq(productionStations.tenantId, tenantId))
        .orderBy(productionStations.sortOrder, productionStations.id),
    );
  }

  async createStation(tenantId: string, input: any) {
    const data = this.validateStation(input, true);
    return this.db.withTenantContext(tenantId, async (tx) => {
      const [row] = await tx
        .insert(productionStations)
        .values({ tenantId, ...data })
        .returning();
      return row;
    });
  }

  async updateStation(tenantId: string, id: string, input: any) {
    this.id(id);
    const data = this.validateStation(input, false);
    if (!Object.keys(data).length)
      throw new BadRequestException('No changes supplied.');
    return this.db.withTenantContext(tenantId, async (tx) => {
      const [row] = await tx
        .update(productionStations)
        .set({ ...data, updatedAt: new Date() })
        .where(
          and(
            eq(productionStations.tenantId, tenantId),
            eq(productionStations.id, id),
          ),
        )
        .returning();
      if (!row) throw new NotFoundException('Station not found.');
      return row;
    });
  }

  async deleteStation(tenantId: string, id: string) {
    this.id(id);
    return this.db.withTenantContext(tenantId, async (tx) => {
      const [row] = await tx
        .delete(productionStations)
        .where(
          and(
            eq(productionStations.tenantId, tenantId),
            eq(productionStations.id, id),
          ),
        )
        .returning();
      if (!row) throw new NotFoundException('Station not found.');
      return row;
    });
  }

  listRouting(tenantId: string) {
    return this.db.withTenantContext(tenantId, (tx) =>
      tx
        .select({
          productId: productRouting.productId,
          stationId: productRouting.stationId,
          productName: catalogProducts.name,
          stationName: productionStations.name,
          stationKind: productionStations.kind,
        })
        .from(productRouting)
        .innerJoin(
          catalogProducts,
          and(
            eq(catalogProducts.tenantId, productRouting.tenantId),
            eq(catalogProducts.id, productRouting.productId),
          ),
        )
        .innerJoin(
          productionStations,
          and(
            eq(productionStations.tenantId, productRouting.tenantId),
            eq(productionStations.id, productRouting.stationId),
          ),
        )
        .where(eq(productRouting.tenantId, tenantId)),
    );
  }

  async setRouting(tenantId: string, productId: string, stationId: string) {
    this.id(productId);
    this.id(stationId);
    return this.db.withTenantContext(tenantId, async (tx) => {
      const product = await tx
        .select()
        .from(catalogProducts)
        .where(
          and(
            eq(catalogProducts.tenantId, tenantId),
            eq(catalogProducts.id, productId),
          ),
        )
        .limit(1);
      if (!product[0]) throw new NotFoundException('Product not found.');

      const station = await tx
        .select()
        .from(productionStations)
        .where(
          and(
            eq(productionStations.tenantId, tenantId),
            eq(productionStations.id, stationId),
            eq(productionStations.active, true),
          ),
        )
        .limit(1);
      if (!station[0]) throw new NotFoundException('Station not found.');

      const [row] = await tx
        .insert(productRouting)
        .values({ tenantId, productId, stationId })
        .onConflictDoUpdate({
          target: [productRouting.tenantId, productRouting.productId],
          set: { stationId },
        })
        .returning();
      return row;
    });
  }

  async removeRouting(tenantId: string, productId: string) {
    this.id(productId);
    return this.db.withTenantContext(tenantId, async (tx) => {
      const [row] = await tx
        .delete(productRouting)
        .where(
          and(
            eq(productRouting.tenantId, tenantId),
            eq(productRouting.productId, productId),
          ),
        )
        .returning();
      return row ?? null;
    });
  }

  private validateStation(i: any, create: boolean) {
    const d: any = {};
    if (create || i.name !== undefined) {
      const name = typeof i?.name === 'string' ? i.name.trim() : '';
      if (!name || name.length > 80)
        throw new BadRequestException('Invalid station name.');
      d.name = name;
    }
    if (create || i.kind !== undefined) {
      if (!KINDS.includes(i.kind))
        throw new BadRequestException('Invalid station kind.');
      d.kind = i.kind;
    }
    if (create || i.active !== undefined) {
      if (typeof i.active !== 'boolean')
        throw new BadRequestException('Invalid active flag.');
      d.active = i.active;
    }
    if (create || i.sortOrder !== undefined) {
      const order = Number(i.sortOrder ?? 0);
      if (!Number.isSafeInteger(order) || order < 0)
        throw new BadRequestException('Invalid sort order.');
      d.sortOrder = order;
    }
    if (create) {
      if (!d.name) throw new BadRequestException('Station name is required.');
      if (!d.kind) throw new BadRequestException('Station kind is required.');
      if (d.active === undefined) d.active = true;
      if (d.sortOrder === undefined) d.sortOrder = 0;
    }
    return d;
  }

  private id(value: unknown) {
    if (typeof value !== 'string' || !UUID.test(value))
      throw new BadRequestException('Invalid identifier.');
  }
}