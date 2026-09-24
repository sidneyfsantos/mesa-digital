import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service.js';
import { authSessions } from '../database/schema/index.js';
import { Capability } from './capabilities.js';
import { PasswordService } from './password.service.js';
const hash = (token: string) =>
  createHash('sha256').update(token).digest('hex');
@Injectable()
export class AuthenticationService {
  constructor(
    private db: DatabaseService,
    private passwords: PasswordService,
  ) {}
  async login(email: string, password: string, tenantSlug: string) {
    const normalized = email?.trim().toLowerCase();
    const row = await this.db.transaction(
      async (tx) =>
        (
          await tx.execute<any>(
            sql`select * from resolve_login_identity(${normalized},${tenantSlug?.trim().toLowerCase()})`,
          )
        ).rows[0],
    );
    if (
      !row ||
      !row.password_hash ||
      !(await this.passwords.verify(password ?? '', row.password_hash))
    )
      throw new UnauthorizedException('Invalid credentials.');
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);
    await this.db.withTenantContext(row.tenant_id, (tx) =>
      tx.insert(authSessions).values({
        tenantId: row.tenant_id,
        tenantUserId: row.tenant_user_id,
        userId: row.user_id,
        tokenHash: hash(token),
        expiresAt,
      }),
    );
    return { token, expiresAt };
  }
  async logout(token: string) {
    const principal = await this.resolve(token);
    if (principal)
      await this.db.withTenantContext(principal.tenantId, (tx) =>
        tx
          .update(authSessions)
          .set({ revokedAt: new Date() })
          .where(sql`${authSessions.tokenHash}=${hash(token)}`),
      );
  }
  async resolve(token: string | undefined) {
    if (!token) return null;
    const row = await this.db.transaction(
      async (tx) =>
        (
          await tx.execute<any>(
            sql`select * from resolve_auth_principal(${hash(token)})`,
          )
        ).rows[0],
    );
    if (!row) return null;
    return {
      userId: row.user_id,
      tenantId: row.tenant_id,
      tenantUserId: row.tenant_user_id,
      capabilities: new Set(row.capabilities as Capability[]),
    };
  }
}
