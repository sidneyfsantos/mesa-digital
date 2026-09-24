import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { EntryModeRepository } from '../database/repositories/entry-mode.repository.js';
import type { ServicePointKind } from '../database/repositories/service-point.repository.js';
const KINDS = new Set<ServicePointKind>(['FIXED_TABLE', 'MOBILE_TAB']);
@Injectable()
export class EntryModeService {
  constructor(private readonly database: DatabaseService, private readonly repository: EntryModeRepository) {}
  async get(tenantId: string) { const rows = await this.database.withTenantContext(tenantId, (tx) => this.repository.list(tx, tenantId)); return { enabledServicePointKinds: rows.map(({ servicePointKind }) => servicePointKind).sort() }; }
  async replace(tenantId: string, input: { enabledServicePointKinds: ServicePointKind[] }) {
    const kinds = input?.enabledServicePointKinds;
    if (!Array.isArray(kinds) || kinds.length === 0 || new Set(kinds).size !== kinds.length || kinds.some((kind) => !KINDS.has(kind))) throw new BadRequestException('At least one valid, unique entry mode is required.');
    const rows = await this.database.withTenantContext(tenantId, (tx) => this.repository.replace(tx, tenantId, kinds));
    return { enabledServicePointKinds: rows.map(({ servicePointKind }) => servicePointKind).sort() };
  }
}
