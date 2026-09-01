import { Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DatabaseTransaction } from '../database.service.js';
import { restaurantTables } from '../schema/index.js';
@Injectable()
export class TableRepository {
  list(transaction: DatabaseTransaction, tenantId: string) {
    return transaction
      .select()
      .from(restaurantTables)
      .where(eq(restaurantTables.tenantId, tenantId));
  }
  findById(
    transaction: DatabaseTransaction,
    tenantId: string,
    tableId: string,
  ) {
    return transaction
      .select()
      .from(restaurantTables)
      .where(
        and(
          eq(restaurantTables.tenantId, tenantId),
          eq(restaurantTables.id, tableId),
        ),
      )
      .limit(1);
  }
  create(
    transaction: DatabaseTransaction,
    tenantId: string,
    data: { label: string; code?: string },
  ) {
    return transaction
      .insert(restaurantTables)
      .values({ tenantId, label: data.label, code: data.code })
      .returning();
  }
  update(
    transaction: DatabaseTransaction,
    tenantId: string,
    tableId: string,
    data: { label?: string; code?: string | null; active?: boolean },
  ) {
    return transaction
      .update(restaurantTables)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(
          eq(restaurantTables.tenantId, tenantId),
          eq(restaurantTables.id, tableId),
        ),
      )
      .returning();
  }
}
