import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { TableRepository } from '../database/repositories/table.repository.js';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export interface TableInput {
  label: string;
  code?: string;
}
export interface TableUpdate {
  label?: string;
  code?: string | null;
  active?: boolean;
}

@Injectable()
export class TableService {
  constructor(
    private readonly database: DatabaseService,
    private readonly repository: TableRepository,
  ) {}
  list(tenantId: string) {
    return this.database.withTenantContext(tenantId, (tx) =>
      this.repository.list(tx, tenantId),
    );
  }
  async create(tenantId: string, input: TableInput) {
    const data = this.validateCreate(input);
    const [created] = await this.database.withTenantContext(tenantId, (tx) =>
      this.repository.create(tx, tenantId, data),
    );
    return created;
  }
  async update(tenantId: string, tableId: string, input: TableUpdate) {
    this.validateId(tableId);
    const data = this.validateUpdate(input);
    const [updated] = await this.database.withTenantContext(tenantId, (tx) =>
      this.repository.update(tx, tenantId, tableId, data),
    );
    if (!updated) throw new NotFoundException('Table not found.');
    return updated;
  }
  setActive(tenantId: string, tableId: string, active: boolean) {
    return this.update(tenantId, tableId, { active });
  }
  private validateCreate(input: TableInput): TableInput {
    const label = typeof input?.label === 'string' ? input.label.trim() : '';
    if (!label || label.length > 100)
      throw new BadRequestException('A valid table label is required.');
    const code = input.code?.trim();
    if (code !== undefined && (!code || code.length > 50))
      throw new BadRequestException('Invalid table code.');
    return { label, ...(code ? { code } : {}) };
  }
  private validateUpdate(input: TableUpdate): TableUpdate {
    const data: TableUpdate = {};
    if (input.label !== undefined) {
      const label = typeof input.label === 'string' ? input.label.trim() : '';
      if (!label || label.length > 100)
        throw new BadRequestException('Invalid table label.');
      data.label = label;
    }
    if (input.code !== undefined) {
      if (input.code === null) data.code = null;
      else {
        const code = typeof input.code === 'string' ? input.code.trim() : '';
        if (!code || code.length > 50)
          throw new BadRequestException('Invalid table code.');
        data.code = code;
      }
    }
    if (input.active !== undefined) {
      if (typeof input.active !== 'boolean')
        throw new BadRequestException('Invalid active state.');
      data.active = input.active;
    }
    if (Object.keys(data).length === 0)
      throw new BadRequestException('No valid table changes supplied.');
    return data;
  }
  private validateId(id: string) {
    if (!UUID_PATTERN.test(id)) throw new NotFoundException('Table not found.');
  }
}
