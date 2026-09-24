import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DatabaseTransaction } from '../database.service.js';
import { tenantEntryModes } from '../schema/index.js';
import type { ServicePointKind } from './service-point.repository.js';
@Injectable()
export class EntryModeRepository {
  list(transaction: DatabaseTransaction, tenantId: string) { return transaction.select({ servicePointKind: tenantEntryModes.servicePointKind }).from(tenantEntryModes).where(eq(tenantEntryModes.tenantId, tenantId)); }
  async replace(transaction: DatabaseTransaction, tenantId: string, kinds: ServicePointKind[]) {
    await transaction.delete(tenantEntryModes).where(eq(tenantEntryModes.tenantId, tenantId));
    return transaction.insert(tenantEntryModes).values(kinds.map((servicePointKind) => ({ tenantId, servicePointKind }))).returning({ servicePointKind: tenantEntryModes.servicePointKind });
  }
}
