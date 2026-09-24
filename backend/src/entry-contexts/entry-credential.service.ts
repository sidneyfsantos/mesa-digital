import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { EntryCredentialRepository } from '../database/repositories/entry-credential.repository.js';
import { QR_TOKEN_PATTERN, QrTokenService } from './qr-token.service.js';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export interface IssuedEntryQr { token: string; credentialId: string; createdAt: Date; }
@Injectable()
export class EntryCredentialService {
  constructor(private readonly database: DatabaseService, private readonly repository: EntryCredentialRepository, private readonly tokens: QrTokenService) {}
  issue(tenantId: string, servicePointId: string) { return this.rotate(tenantId, servicePointId, false); }
  regenerate(tenantId: string, servicePointId: string) { return this.rotate(tenantId, servicePointId, true); }
  private async rotate(tenantId: string, servicePointId: string, replace: boolean): Promise<IssuedEntryQr> {
    this.validateId(servicePointId);
    return this.database.withTenantContext(tenantId, async (tx) => {
      if (!(await this.repository.lockServicePoint(tx, tenantId, servicePointId))) throw new NotFoundException('Service point not found.');
      const active = await this.repository.findActive(tx, tenantId, servicePointId);
      if (!replace && active.length > 0) throw new ConflictException('Service point already has an active QR credential.');
      if (replace) await this.repository.revokeActive(tx, tenantId, servicePointId);
      const generated = this.tokens.generate(); const [credential] = await this.repository.create(tx, tenantId, servicePointId, generated.hash);
      return { token: generated.token, credentialId: credential.id, createdAt: credential.createdAt };
    });
  }
  async revoke(tenantId: string, servicePointId: string): Promise<void> { this.validateId(servicePointId); await this.database.withTenantContext(tenantId, async (tx) => { if (!(await this.repository.lockServicePoint(tx, tenantId, servicePointId))) throw new NotFoundException('Service point not found.'); await this.repository.revokeActive(tx, tenantId, servicePointId); }); }
  history(tenantId: string, servicePointId: string) { this.validateId(servicePointId); return this.database.withTenantContext(tenantId, (tx) => this.repository.listHistory(tx, tenantId, servicePointId)); }
  async resolvePublic(token: string) {
    if (!QR_TOKEN_PATTERN.test(token)) throw new NotFoundException('Entry credential not found.');
    const context = await this.database.transaction((tx) => this.repository.resolvePublic(tx, this.tokens.hash(token)));
    if (!context) throw new NotFoundException('Entry credential not found.');
    return { establishment: { name: context.tenantName }, entry: { kind: 'QR', servicePoint: { kind: context.servicePointKind, label: context.servicePointLabel } } };
  }
  private validateId(id: string) { if (!UUID_PATTERN.test(id)) throw new NotFoundException('Service point not found.'); }
}
