import { randomUUID } from 'node:crypto';
import { UnauthorizedException } from '@nestjs/common';
import { Pool } from 'pg';
import { AuthenticationService } from '../src/auth/authentication.service.js';
import { AuthorizationBootstrapService } from '../src/auth/authorization-bootstrap.service.js';
import { PasswordService } from '../src/auth/password.service.js';
import { DatabaseService } from '../src/database/database.service.js';
describe('Administrative authentication', () => {
  const admin = new Pool({ connectionString: process.env.DATABASE_ADMIN_URL });
  const db = new DatabaseService();
  const passwords = new PasswordService();
  const auth = new AuthenticationService(db, passwords);
  const tenant = randomUUID(),
    user = randomUUID(),
    tenantUser = randomUUID();
  const slug = `auth-${tenant}`;
  beforeAll(async () => {
    const hash = await passwords.hash('very strong local password');
    await admin.query(`insert into tenants(id,name,slug) values($1,'Auth Tenant',$2)`,[tenant,slug]);
    await admin.query(`insert into users(id,email,name,password_hash) values($1,'owner@example.test','Owner',$2)`,[user,hash]);
    await admin.query(`insert into tenant_users(id,tenant_id,user_id) values($1,$2,$3)`,[tenantUser,tenant,user]);
    await new AuthorizationBootstrapService(db).bootstrapTenant(tenant);
    await admin.query(
      `insert into tenant_user_roles(tenant_id,tenant_user_id,role_id) select $1,$2,id from roles where tenant_id=$1 and key='owner'`,
      [tenant, tenantUser],
    );
  });
  afterAll(async () => {
    await admin.query('delete from auth_sessions where tenant_id=$1', [tenant]);
    await admin.query('delete from tenant_user_roles where tenant_id=$1', [
      tenant,
    ]);
    await admin.query('delete from role_capabilities where tenant_id=$1', [
      tenant,
    ]);
    await admin.query('delete from roles where tenant_id=$1', [tenant]);
    await admin.query('delete from tenant_users where tenant_id=$1', [tenant]);
    await admin.query('delete from users where id=$1', [user]);
    await admin.query('delete from tenants where id=$1', [tenant]);
    await db.onApplicationShutdown();
    await admin.end();
  });
  it('creates, resolves and revokes an opaque session with capabilities', async () => {
    const session = await auth.login(
      'OWNER@EXAMPLE.TEST',
      'very strong local password',
      slug,
    );
    expect(session.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const principal = await auth.resolve(session.token);
    expect(principal).toMatchObject({
      userId: user,
      tenantId: tenant,
      tenantUserId: tenantUser,
    });
    expect(principal!.capabilities.has('catalog.manage')).toBe(true);
    await auth.logout(session.token);
    await expect(auth.resolve(session.token)).resolves.toBeNull();
  });
  it('returns the same failure for invalid credentials', async () => {
    await expect(
      auth.login('owner@example.test', 'wrong password', slug),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      auth.login('missing@example.test', 'anything here', slug),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
