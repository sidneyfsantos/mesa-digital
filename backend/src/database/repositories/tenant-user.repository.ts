import { Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DatabaseTransaction } from '../database.service.js';
import { tenantUsers } from '../schema/index.js';

@Injectable()
export class TenantUserRepository {
  findByTenant(transaction: DatabaseTransaction, tenantId: string) {
    return transaction
      .select()
      .from(tenantUsers)
      .where(eq(tenantUsers.tenantId, tenantId));
  }

  create(
    transaction: DatabaseTransaction,
    tenantId: string,
    userId: string,
  ) {
    return transaction
      .insert(tenantUsers)
      .values({ tenantId, userId })
      .returning();
  }

  updateStatus(
    transaction: DatabaseTransaction,
    tenantId: string,
    userId: string,
    status: 'ACTIVE' | 'INACTIVE',
  ) {
    return transaction
      .update(tenantUsers)
      .set({ status, updatedAt: new Date() })
      .where(
        and(
          eq(tenantUsers.tenantId, tenantId),
          eq(tenantUsers.userId, userId),
        ),
      )
      .returning();
  }
}
