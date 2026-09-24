import { Injectable } from '@nestjs/common';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { DatabaseTransaction } from '../database.service.js';
import { entryCredentials, servicePoints } from '../schema/index.js';
export interface PublicEntryContext { tenantName: string; servicePointKind: 'FIXED_TABLE' | 'MOBILE_TAB'; servicePointLabel: string; }
@Injectable()
export class EntryCredentialRepository {
  async lockServicePoint(transaction: DatabaseTransaction, tenantId: string, servicePointId: string): Promise<boolean> { const result = await transaction.execute(sql`select id from service_points where tenant_id = ${tenantId} and id = ${servicePointId} for update`); return result.rows.length === 1; }
  findActive(transaction: DatabaseTransaction, tenantId: string, servicePointId: string) { return transaction.select({ id: entryCredentials.id, createdAt: entryCredentials.createdAt }).from(entryCredentials).where(and(eq(entryCredentials.tenantId, tenantId), eq(entryCredentials.servicePointId, servicePointId), eq(entryCredentials.kind, 'QR'), isNull(entryCredentials.revokedAt))).limit(1); }
  revokeActive(transaction: DatabaseTransaction, tenantId: string, servicePointId: string) { return transaction.update(entryCredentials).set({ revokedAt: new Date() }).where(and(eq(entryCredentials.tenantId, tenantId), eq(entryCredentials.servicePointId, servicePointId), eq(entryCredentials.kind, 'QR'), isNull(entryCredentials.revokedAt))).returning({ id: entryCredentials.id }); }
  create(transaction: DatabaseTransaction, tenantId: string, servicePointId: string, tokenHash: string) { return transaction.insert(entryCredentials).values({ tenantId, servicePointId, tokenHash }).returning({ id: entryCredentials.id, createdAt: entryCredentials.createdAt }); }
  async resolvePublic(transaction: DatabaseTransaction, tokenHash: string): Promise<PublicEntryContext | undefined> {
    const result = await transaction.execute<{ tenant_name: string; service_point_kind: 'FIXED_TABLE' | 'MOBILE_TAB'; service_point_label: string }>(sql`select tenant_name, service_point_kind, service_point_label from resolve_public_entry_qr(${tokenHash})`);
    const row = result.rows[0]; return row ? { tenantName: row.tenant_name, servicePointKind: row.service_point_kind, servicePointLabel: row.service_point_label } : undefined;
  }
  listHistory(transaction: DatabaseTransaction, tenantId: string, servicePointId: string) { return transaction.select({ id: entryCredentials.id, kind: entryCredentials.kind, createdAt: entryCredentials.createdAt, revokedAt: entryCredentials.revokedAt }).from(entryCredentials).innerJoin(servicePoints, and(eq(servicePoints.tenantId, entryCredentials.tenantId), eq(servicePoints.id, entryCredentials.servicePointId))).where(and(eq(entryCredentials.tenantId, tenantId), eq(entryCredentials.servicePointId, servicePointId))); }
}
