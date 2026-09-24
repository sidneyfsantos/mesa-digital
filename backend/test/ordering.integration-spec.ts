import { randomUUID } from 'node:crypto';
import { ConflictException } from '@nestjs/common';
import { Pool } from 'pg';
import { CatalogService } from '../src/catalog/catalog.service.js';
import { DatabaseService } from '../src/database/database.service.js';
import { CatalogRepository } from '../src/database/repositories/catalog.repository.js';
import { EntryCredentialRepository } from '../src/database/repositories/entry-credential.repository.js';
import { EntryModeRepository } from '../src/database/repositories/entry-mode.repository.js';
import { ServicePointRepository } from '../src/database/repositories/service-point.repository.js';
import { EntryCredentialService } from '../src/entry-contexts/entry-credential.service.js';
import { EntryModeService } from '../src/entry-contexts/entry-mode.service.js';
import { QrTokenService } from '../src/entry-contexts/qr-token.service.js';
import { ServicePointService } from '../src/entry-contexts/service-point.service.js';
import { OrderService } from '../src/ordering/order.service.js';
describe('First order, rounds and snapshots', () => {
  const admin = new Pool({ connectionString: process.env.DATABASE_ADMIN_URL });
  const db = new DatabaseService();
  const repo = new CatalogRepository();
  const catalog = new CatalogService(db, repo);
  const tokens = new QrTokenService();
  const orders = new OrderService(db, repo, tokens);
  const modes = new EntryModeService(db, new EntryModeRepository());
  const points = new ServicePointService(
    db,
    new ServicePointRepository(),
    new EntryModeRepository(),
  );
  const credentials = new EntryCredentialService(
    db,
    new EntryCredentialRepository(),
    tokens,
  );
  const tenant = randomUUID(),
    other = randomUUID();
  let token: string, product: string, otherProduct: string;
  beforeAll(async () => {
    await admin.query(
      `insert into tenants(id,name,slug) values($1,'Order A',$2),($3,'Order B',$4)`,
      [tenant, `order-a-${tenant}`, other, `order-b-${other}`],
    );
    await modes.replace(tenant, { enabledServicePointKinds: ['FIXED_TABLE'] });
    const point = await points.create(tenant, {
      kind: 'FIXED_TABLE',
      label: 'Mesa 1',
    });
    token = (await credentials.issue(tenant, point.id)).token;
    const category = (await catalog.createCategory(tenant, { name: 'Pratos' }))
      .id;
    product = (
      await catalog.createProduct(tenant, {
        categoryId: category,
        name: 'Original',
        priceMinor: 3200,
      })
    ).id;
    const otherCategory = (
      await catalog.createCategory(other, { name: 'Outro' })
    ).id;
    otherProduct = (
      await catalog.createProduct(other, {
        categoryId: otherCategory,
        name: 'Segredo',
        priceMinor: 1,
      })
    ).id;
  });
  afterAll(async () => {
    for (const table of [
      'outbox_events',
      'order_status_history',
      'order_item_modifiers',
      'order_items',
      'orders',
      'service_sessions',
      'product_modifier_groups',
      'modifier_options',
      'modifier_groups',
      'catalog_products',
      'catalog_categories',
      'entry_credentials',
      'service_points',
      'tenant_entry_modes',
    ])
      await admin.query(`delete from ${table} where tenant_id=any($1)`, [
        [tenant, other],
      ]);
    await admin.query('delete from tenants where id=any($1)', [
      [tenant, other],
    ]);
    await db.onApplicationShutdown();
    await admin.end();
  });
  it('creates one session atomically and separate rounds under concurrency', async () => {
    const [a, b] = await Promise.all([
      orders.create(token, 'round-a', {
        items: [{ productId: product, quantity: 1, modifierOptionIds: [] }],
      }),
      orders.create(token, 'round-b', {
        items: [{ productId: product, quantity: 2, modifierOptionIds: [] }],
      }),
    ]);
    expect(a.order.id).not.toBe(b.order.id);
    const count = await admin.query(
      `select count(distinct service_session_id) sessions,count(*) orders from orders where tenant_id=$1`,
      [tenant],
    );
    expect(count.rows[0]).toMatchObject({ sessions: '1', orders: '2' });
  });
  it('reuses the same result for the same key and rejects a changed payload', async () => {
    const payload = {
      items: [{ productId: product, quantity: 1, modifierOptionIds: [] }],
    };
    const first = await orders.create(token, 'retry-key', payload);
    const retry = await orders.create(token, 'retry-key', payload);
    expect(retry.order.id).toBe(first.order.id);
    await expect(
      orders.create(token, 'retry-key', {
        items: [{ productId: product, quantity: 2, modifierOptionIds: [] }],
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
  it('uses canonical prices and keeps snapshots after catalog changes', async () => {
    const result = await orders.create(token, 'snapshot', {
      items: [{ productId: product, quantity: 2, modifierOptionIds: [] }],
    } as any);
    expect(result.order.totalMinor).toBe(6400);
    await catalog.updateProduct(tenant, product, {
      name: 'Novo',
      priceMinor: 5000,
    });
    const stored = await admin.query(
      `select product_name_snapshot,unit_price_minor,line_total_minor from order_items where order_id=$1`,
      [result.order.id],
    );
    expect(stored.rows[0]).toEqual({
      product_name_snapshot: 'Original',
      unit_price_minor: 3200,
      line_total_minor: 6400,
    });
  });
  it('rejects unavailable and cross-tenant products without partial orders', async () => {
    await expect(
      orders.create(token, 'cross', {
        items: [
          { productId: otherProduct, quantity: 1, modifierOptionIds: [] },
        ],
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    await catalog.updateProduct(tenant, product, { available: false });
    await expect(
      orders.create(token, 'unavailable', {
        items: [{ productId: product, quantity: 1, modifierOptionIds: [] }],
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    const count = await admin.query(
      `select count(*) from orders where tenant_id=$1 and idempotency_key in ('cross','unavailable')`,
      [tenant],
    );
    expect(count.rows[0].count).toBe('0');
  });
});
