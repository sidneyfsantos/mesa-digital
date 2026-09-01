import { Injectable } from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service.js';
import {
  accessRoles,
  capabilities,
  roleCapabilities,
} from '../database/schema/index.js';
import {
  STANDARD_ROLE_CAPABILITIES,
  STANDARD_ROLE_NAMES,
  StandardRole,
} from './capabilities.js';

const STANDARD_ROLES = Object.keys(STANDARD_ROLE_NAMES) as StandardRole[];

@Injectable()
export class AuthorizationBootstrapService {
  constructor(private readonly database: DatabaseService) {}

  async bootstrapTenant(tenantId: string): Promise<void> {
    await this.database.withTenantContext(tenantId, async (transaction) => {
      await transaction
        .insert(accessRoles)
        .values(
          STANDARD_ROLES.map((key) => ({
            tenantId,
            key,
            name: STANDARD_ROLE_NAMES[key],
          })),
        )
        .onConflictDoNothing();
      const roles = await transaction
        .select({ id: accessRoles.id, key: accessRoles.key })
        .from(accessRoles)
        .where(
          and(
            eq(accessRoles.tenantId, tenantId),
            inArray(accessRoles.key, STANDARD_ROLES),
          ),
        );
      const capabilityRows = await transaction
        .select({ id: capabilities.id, key: capabilities.key })
        .from(capabilities);
      const capabilityIds = new Map(
        capabilityRows.map(({ id, key }) => [key, id]),
      );
      const assignments = roles.flatMap((role) =>
        STANDARD_ROLE_CAPABILITIES[role.key as StandardRole].map((key) => ({
          tenantId,
          roleId: role.id,
          capabilityId: capabilityIds.get(key)!,
        })),
      );
      if (assignments.length > 0)
        await transaction
          .insert(roleCapabilities)
          .values(assignments)
          .onConflictDoNothing();
    });
  }
}
