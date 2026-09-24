import { Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DatabaseTransaction } from '../database.service.js';
import { servicePoints } from '../schema/index.js';
export type ServicePointKind = 'FIXED_TABLE' | 'MOBILE_TAB';
@Injectable()
export class ServicePointRepository {
  list(transaction: DatabaseTransaction, tenantId: string) { return transaction.select().from(servicePoints).where(eq(servicePoints.tenantId, tenantId)); }
  create(transaction: DatabaseTransaction, tenantId: string, data: { kind: ServicePointKind; label: string; code?: string }) { return transaction.insert(servicePoints).values({ tenantId, ...data }).returning(); }
  update(transaction: DatabaseTransaction, tenantId: string, servicePointId: string, data: { label?: string; code?: string | null; active?: boolean }) { return transaction.update(servicePoints).set({ ...data, updatedAt: new Date() }).where(and(eq(servicePoints.tenantId, tenantId), eq(servicePoints.id, servicePointId))).returning(); }
}
