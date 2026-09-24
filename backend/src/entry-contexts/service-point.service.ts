import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { EntryModeRepository } from '../database/repositories/entry-mode.repository.js';
import { ServicePointKind, ServicePointRepository } from '../database/repositories/service-point.repository.js';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const KINDS = new Set<ServicePointKind>(['FIXED_TABLE', 'MOBILE_TAB']);
export interface ServicePointInput { kind: ServicePointKind; label: string; code?: string; }
export interface ServicePointUpdate { label?: string; code?: string | null; active?: boolean; }
@Injectable()
export class ServicePointService {
  constructor(private readonly database: DatabaseService, private readonly repository: ServicePointRepository, private readonly modes: EntryModeRepository) {}
  list(tenantId: string) { return this.database.withTenantContext(tenantId, (tx) => this.repository.list(tx, tenantId)); }
  async create(tenantId: string, input: ServicePointInput) {
    const data = this.validateCreate(input);
    return this.database.withTenantContext(tenantId, async (tx) => {
      const enabled = await this.modes.list(tx, tenantId);
      if (!enabled.some(({ servicePointKind }) => servicePointKind === data.kind)) throw new ConflictException('Service point kind is not enabled for this tenant.');
      const [created] = await this.repository.create(tx, tenantId, data); return created;
    });
  }
  async update(tenantId: string, servicePointId: string, input: ServicePointUpdate) {
    this.validateId(servicePointId); const data = this.validateUpdate(input);
    const [updated] = await this.database.withTenantContext(tenantId, (tx) => this.repository.update(tx, tenantId, servicePointId, data));
    if (!updated) throw new NotFoundException('Service point not found.'); return updated;
  }
  setActive(tenantId: string, servicePointId: string, active: boolean) { return this.update(tenantId, servicePointId, { active }); }
  private validateCreate(input: ServicePointInput): ServicePointInput {
    if (!KINDS.has(input?.kind)) throw new BadRequestException('A valid service point kind is required.');
    const label = typeof input?.label === 'string' ? input.label.trim() : '';
    if (!label || label.length > 100) throw new BadRequestException('A valid service point label is required.');
    const code = input.code?.trim(); if (code !== undefined && (!code || code.length > 50)) throw new BadRequestException('Invalid service point code.');
    return { kind: input.kind, label, ...(code ? { code } : {}) };
  }
  private validateUpdate(input: ServicePointUpdate): ServicePointUpdate {
    const data: ServicePointUpdate = {};
    if (input.label !== undefined) { const label = typeof input.label === 'string' ? input.label.trim() : ''; if (!label || label.length > 100) throw new BadRequestException('Invalid service point label.'); data.label = label; }
    if (input.code !== undefined) { if (input.code === null) data.code = null; else { const code = typeof input.code === 'string' ? input.code.trim() : ''; if (!code || code.length > 50) throw new BadRequestException('Invalid service point code.'); data.code = code; } }
    if (input.active !== undefined) { if (typeof input.active !== 'boolean') throw new BadRequestException('Invalid active state.'); data.active = input.active; }
    if (Object.keys(data).length === 0) throw new BadRequestException('No valid service point changes supplied.'); return data;
  }
  private validateId(id: string) { if (!UUID_PATTERN.test(id)) throw new NotFoundException('Service point not found.'); }
}
