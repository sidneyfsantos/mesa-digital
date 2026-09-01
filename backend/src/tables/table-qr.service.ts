import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { TableQrRepository } from '../database/repositories/table-qr.repository.js';
import {
  TableQrTokenService,
  TABLE_QR_TOKEN_PATTERN,
} from './table-qr-token.service.js';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export interface IssuedTableQr {
  token: string;
  credentialId: string;
  createdAt: Date;
}

@Injectable()
export class TableQrService {
  constructor(
    private readonly database: DatabaseService,
    private readonly repository: TableQrRepository,
    private readonly tokens: TableQrTokenService,
  ) {}
  issue(tenantId: string, tableId: string) {
    return this.rotate(tenantId, tableId, false);
  }
  regenerate(tenantId: string, tableId: string) {
    return this.rotate(tenantId, tableId, true);
  }
  private async rotate(
    tenantId: string,
    tableId: string,
    replace: boolean,
  ): Promise<IssuedTableQr> {
    this.validateId(tableId);
    return this.database.withTenantContext(tenantId, async (tx) => {
      if (!(await this.repository.lockTable(tx, tenantId, tableId)))
        throw new NotFoundException('Table not found.');
      const active = await this.repository.findActive(tx, tenantId, tableId);
      if (!replace && active.length > 0)
        throw new ConflictException(
          'Table already has an active QR credential.',
        );
      if (replace) await this.repository.revokeActive(tx, tenantId, tableId);
      const generated = this.tokens.generate();
      const [credential] = await this.repository.create(
        tx,
        tenantId,
        tableId,
        generated.hash,
      );
      return {
        token: generated.token,
        credentialId: credential.id,
        createdAt: credential.createdAt,
      };
    });
  }
  async revoke(tenantId: string, tableId: string): Promise<void> {
    this.validateId(tableId);
    await this.database.withTenantContext(tenantId, async (tx) => {
      if (!(await this.repository.lockTable(tx, tenantId, tableId)))
        throw new NotFoundException('Table not found.');
      await this.repository.revokeActive(tx, tenantId, tableId);
    });
  }
  history(tenantId: string, tableId: string) {
    this.validateId(tableId);
    return this.database.withTenantContext(tenantId, (tx) =>
      this.repository.listHistory(tx, tenantId, tableId),
    );
  }
  async resolvePublic(token: string) {
    if (!TABLE_QR_TOKEN_PATTERN.test(token))
      throw new NotFoundException('QR credential not found.');
    const hash = this.tokens.hash(token);
    const context = await this.database.transaction((tx) =>
      this.repository.resolvePublic(tx, hash),
    );
    if (!context) throw new NotFoundException('QR credential not found.');
    return {
      establishment: { name: context.tenantName },
      table: { label: context.tableLabel },
    };
  }
  private validateId(id: string) {
    if (!UUID_PATTERN.test(id)) throw new NotFoundException('Table not found.');
  }
}
