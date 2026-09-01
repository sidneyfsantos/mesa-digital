import { Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DatabaseTransaction } from '../database.service.js';
import {
  capabilities,
  roleCapabilities,
  tenantUserRoles,
  accessRoles,
} from '../schema/index.js';

@Injectable()
export class AccessRepository {
  findRoles(transaction: DatabaseTransaction, tenantId: string) {
    return transaction
      .select()
      .from(accessRoles)
      .where(eq(accessRoles.tenantId, tenantId));
  }

  async findEffectiveCapabilities(
    transaction: DatabaseTransaction,
    tenantId: string,
    tenantUserId: string,
  ): Promise<string[]> {
    const rows = await transaction
      .selectDistinct({ key: capabilities.key })
      .from(tenantUserRoles)
      .innerJoin(
        roleCapabilities,
        and(
          eq(roleCapabilities.tenantId, tenantUserRoles.tenantId),
          eq(roleCapabilities.roleId, tenantUserRoles.roleId),
        ),
      )
      .innerJoin(
        capabilities,
        eq(capabilities.id, roleCapabilities.capabilityId),
      )
      .where(
        and(
          eq(tenantUserRoles.tenantId, tenantId),
          eq(tenantUserRoles.tenantUserId, tenantUserId),
        ),
      );
    return rows.map(({ key }) => key);
  }

  assignRole(
    transaction: DatabaseTransaction,
    tenantId: string,
    tenantUserId: string,
    roleId: string,
  ) {
    return transaction
      .insert(tenantUserRoles)
      .values({ tenantId, tenantUserId, roleId })
      .onConflictDoNothing()
      .returning();
  }
}
