import { Injectable } from '@nestjs/common';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { DatabaseTransaction } from '../database.service.js';
import { restaurantTables, tableQrCredentials } from '../schema/index.js';
export interface PublicTableContext {
  tenantName: string;
  tableLabel: string;
}
@Injectable()
export class TableQrRepository {
  async lockTable(
    transaction: DatabaseTransaction,
    tenantId: string,
    tableId: string,
  ): Promise<boolean> {
    const result = await transaction.execute(
      sql`select id from restaurant_tables where tenant_id = ${tenantId} and id = ${tableId} for update`,
    );
    return result.rows.length === 1;
  }
  findActive(
    transaction: DatabaseTransaction,
    tenantId: string,
    tableId: string,
  ) {
    return transaction
      .select({
        id: tableQrCredentials.id,
        createdAt: tableQrCredentials.createdAt,
      })
      .from(tableQrCredentials)
      .where(
        and(
          eq(tableQrCredentials.tenantId, tenantId),
          eq(tableQrCredentials.tableId, tableId),
          isNull(tableQrCredentials.revokedAt),
        ),
      )
      .limit(1);
  }
  revokeActive(
    transaction: DatabaseTransaction,
    tenantId: string,
    tableId: string,
  ) {
    return transaction
      .update(tableQrCredentials)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(tableQrCredentials.tenantId, tenantId),
          eq(tableQrCredentials.tableId, tableId),
          isNull(tableQrCredentials.revokedAt),
        ),
      )
      .returning({ id: tableQrCredentials.id });
  }
  create(
    transaction: DatabaseTransaction,
    tenantId: string,
    tableId: string,
    tokenHash: string,
  ) {
    return transaction
      .insert(tableQrCredentials)
      .values({ tenantId, tableId, tokenHash })
      .returning({
        id: tableQrCredentials.id,
        createdAt: tableQrCredentials.createdAt,
      });
  }
  async resolvePublic(
    transaction: DatabaseTransaction,
    tokenHash: string,
  ): Promise<PublicTableContext | undefined> {
    const result = await transaction.execute<{
      tenant_name: string;
      table_label: string;
    }>(
      sql`select tenant_name, table_label from resolve_public_table_qr(${tokenHash})`,
    );
    const row = result.rows[0];
    return row
      ? { tenantName: row.tenant_name, tableLabel: row.table_label }
      : undefined;
  }
  listHistory(
    transaction: DatabaseTransaction,
    tenantId: string,
    tableId: string,
  ) {
    return transaction
      .select({
        id: tableQrCredentials.id,
        createdAt: tableQrCredentials.createdAt,
        revokedAt: tableQrCredentials.revokedAt,
      })
      .from(tableQrCredentials)
      .innerJoin(
        restaurantTables,
        and(
          eq(restaurantTables.tenantId, tableQrCredentials.tenantId),
          eq(restaurantTables.id, tableQrCredentials.tableId),
        ),
      )
      .where(
        and(
          eq(tableQrCredentials.tenantId, tenantId),
          eq(tableQrCredentials.tableId, tableId),
        ),
      );
  }
}
