import { randomUUID } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
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
import { ProductionService } from '../src/production/production.service.js';
import { KdsService } from '../src/production/kds.service.js';

describe('Production flow: stations, routing, KDS, delivery', () => {
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
  const production = new ProductionService(db);
  const kds = new KdsService(db);

  const tenant = randomUUID(),
    other = randomUUID();
  let token: string;
  let productKitchen: string;
  let productBar: string;
  let stationKitchen: string;
  let stationBar: string;

  async function cleanupTenantData(t: string) {
    await admin.query(`delete from order_item_modifiers where tenant_id=$1`, [t]);
    await admin.query(`delete from order_items where tenant_id=$1`, [t]);
    await admin.query(`delete from order_status_history where tenant_id=$1`, [t]);
    await admin.query(`delete from orders where tenant_id=$1`, [t]);
    await admin.query(`delete from service_sessions where tenant_id=$1`, [t]);
    await admin.query(`delete from outbox_events where tenant_id=$1`, [t]);
  }

  beforeAll(async () => {
    await admin.query(
      `insert into tenants(id,name,slug) values($1,'Prod A',$2),($3,'Prod B',$4)`,
      [tenant, `prod-a-${tenant}`, other, `prod-b-${other}`],
    );
    await modes.replace(tenant, { enabledServicePointKinds: ['FIXED_TABLE'] });
    const point = await points.create(tenant, { kind: 'FIXED_TABLE', label: 'Mesa 1' });
    token = (await credentials.issue(tenant, point.id)).token;

    const cat = (await catalog.createCategory(tenant, { name: 'Pratos' })).id;
    const catDrinks = (await catalog.createCategory(tenant, { name: 'Bebidas' })).id;

    productKitchen = (
      await catalog.createProduct(tenant, {
        categoryId: cat,
        name: 'Hambúrguer',
        priceMinor: 3500,
      })
    ).id;
    productBar = (
      await catalog.createProduct(tenant, {
        categoryId: catDrinks,
        name: 'Cerveja',
        priceMinor: 1200,
      })
    ).id;

    stationKitchen = (
      await production.createStation(tenant, {
        name: 'Cozinha',
        kind: 'KITCHEN',
        active: true,
        sortOrder: 1,
      })
    ).id;
    stationBar = (
      await production.createStation(tenant, {
        name: 'Bar',
        kind: 'BAR',
        active: true,
        sortOrder: 2,
      })
    ).id;

    await production.setRouting(tenant, productKitchen, stationKitchen);
    await production.setRouting(tenant, productBar, stationBar);
  });

  beforeEach(async () => {
    await cleanupTenantData(tenant);
  });

  afterAll(async () => {
    for (const table of [
      'outbox_events',
      'order_status_history',
      'order_item_modifiers',
      'order_items',
      'orders',
      'service_sessions',
      'product_routing',
      'production_stations',
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

  it('routes items to correct stations on order creation', async () => {
    const result = await orders.create(token, 'route-test', {
      items: [
        { productId: productKitchen, quantity: 1, modifierOptionIds: [] },
        { productId: productBar, quantity: 2, modifierOptionIds: [] },
      ],
    });

    expect(result.order.items).toHaveLength(2);
    const kitchenItem = result.order.items.find((i: { name: string }) => i.name === 'Hambúrguer');
    const barItem = result.order.items.find((i: { name: string }) => i.name === 'Cerveja');
    expect(kitchenItem!.stationId).toBe(stationKitchen);
    expect(barItem!.stationId).toBe(stationBar);
  });

  it('shows items in correct station KDS view', async () => {
    await orders.create(token, 'kds-view', {
      items: [
        { productId: productKitchen, quantity: 1, modifierOptionIds: [] },
        { productId: productBar, quantity: 1, modifierOptionIds: [] },
      ],
    });

    const kitchenItems = await kds.getStationItems(tenant, stationKitchen);
    const barItems = await kds.getStationItems(tenant, stationBar);

    expect(kitchenItems).toHaveLength(1);
    expect(kitchenItems[0].productName).toBe('Hambúrguer');
    expect(kitchenItems[0].status).toBe('ACCEPTED');

    expect(barItems).toHaveLength(1);
    expect(barItems[0].productName).toBe('Cerveja');
    expect(barItems[0].status).toBe('ACCEPTED');
  });

  it('transitions item through ACCEPTED -> IN_PREPARATION -> READY -> DELIVERED', async () => {
    const order = await orders.create(token, 'flow-test', {
      items: [{ productId: productKitchen, quantity: 1, modifierOptionIds: [] }],
    });

    const item = order.order.items[0];
    expect(item.status).toBe('ACCEPTED');

    await kds.transitionItem(tenant, item.id, 'IN_PREPARATION', 'user-1');
    let refreshed = await kds.getStationItemsAllStatuses(tenant, stationKitchen, ['ACCEPTED', 'IN_PREPARATION', 'READY']);
    expect(refreshed[0].status).toBe('IN_PREPARATION');
    expect(refreshed[0].startedAt).not.toBeNull();

    await kds.transitionItem(tenant, item.id, 'READY', 'user-1');
    refreshed = await kds.getStationItemsAllStatuses(tenant, stationKitchen, ['ACCEPTED', 'IN_PREPARATION', 'READY']);
    expect(refreshed[0].status).toBe('READY');
    expect(refreshed[0].readyAt).not.toBeNull();

    await kds.transitionItem(tenant, item.id, 'DELIVERED', 'user-1');
    refreshed = await kds.getStationItems(tenant, stationKitchen);
    expect(refreshed).toHaveLength(0);

    const delivered = await kds.getDeliveryItems(tenant);
    expect(delivered).toHaveLength(0);
  });

  it('rejects invalid status transitions', async () => {
    const order = await orders.create(token, 'invalid-flow', {
      items: [{ productId: productKitchen, quantity: 1, modifierOptionIds: [] }],
    });

    const item = order.order.items[0];

    await expect(
      kds.transitionItem(tenant, item.id, 'READY', 'user-1'),
    ).rejects.toBeInstanceOf(BadRequestException);

    await kds.transitionItem(tenant, item.id, 'IN_PREPARATION', 'user-1');

    await expect(
      kds.transitionItem(tenant, item.id, 'ACCEPTED', 'user-1'),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      kds.transitionItem(tenant, item.id, 'CANCELLED', 'user-1'),
    ).resolves.not.toThrow();

    await expect(
      kds.transitionItem(tenant, item.id, 'IN_PREPARATION', 'user-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('items from same order evolve independently', async () => {
    const order = await orders.create(token, 'independent-items', {
      items: [
        { productId: productKitchen, quantity: 1, modifierOptionIds: [] },
        { productId: productBar, quantity: 1, modifierOptionIds: [] },
      ],
    });

    const [kitchenItem, barItem] = order.order.items;

    await kds.transitionItem(tenant, kitchenItem.id, 'IN_PREPARATION', 'user-1');
    await kds.transitionItem(tenant, kitchenItem.id, 'READY', 'user-1');

    let kitchenItems = await kds.getStationItemsAllStatuses(tenant, stationKitchen, ['ACCEPTED', 'IN_PREPARATION', 'READY']);
    let barItems = await kds.getStationItems(tenant, stationBar);
    expect(kitchenItems[0].status).toBe('READY');
    expect(barItems[0].status).toBe('ACCEPTED');

    await kds.transitionItem(tenant, barItem.id, 'IN_PREPARATION', 'user-1');
    await kds.transitionItem(tenant, barItem.id, 'READY', 'user-1');

    kitchenItems = await kds.getStationItems(tenant, stationKitchen);
    barItems = await kds.getStationItems(tenant, stationBar);
    expect(kitchenItems).toHaveLength(0);
    expect(barItems).toHaveLength(0);

    const delivered = await kds.getDeliveryItems(tenant);
    expect(delivered).toHaveLength(2);
  });

  it('READY items appear in delivery view', async () => {
    const order = await orders.create(token, 'delivery-test', {
      items: [
        { productId: productKitchen, quantity: 1, modifierOptionIds: [] },
        { productId: productBar, quantity: 1, modifierOptionIds: [] },
      ],
    });

    const [kitchenItem, barItem] = order.order.items;

    await kds.transitionItem(tenant, kitchenItem.id, 'IN_PREPARATION', 'user-1');
    await kds.transitionItem(tenant, kitchenItem.id, 'READY', 'user-1');

    let delivery = await kds.getDeliveryItems(tenant);
    expect(delivery).toHaveLength(1);
    expect(delivery[0].productName).toBe('Hambúrguer');

    await kds.transitionItem(tenant, barItem.id, 'IN_PREPARATION', 'user-1');
    await kds.transitionItem(tenant, barItem.id, 'READY', 'user-1');

    delivery = await kds.getDeliveryItems(tenant);
    expect(delivery).toHaveLength(2);
  });

  it('maintains cross-tenant isolation', async () => {
    await modes.replace(other, { enabledServicePointKinds: ['FIXED_TABLE'] });
    const otherPoint = await points.create(other, { kind: 'FIXED_TABLE', label: 'Mesa 1' });
    const otherToken = (await credentials.issue(other, otherPoint.id)).token;

    const otherCat = (await catalog.createCategory(other, { name: 'Outro' })).id;
    const otherProduct = (
      await catalog.createProduct(other, {
        categoryId: otherCat,
        name: 'Secreto',
        priceMinor: 100,
      })
    ).id;

    const otherStation = (
      await production.createStation(other, {
        name: 'Cozinha Secreta',
        kind: 'KITCHEN',
        active: true,
        sortOrder: 1,
      })
    ).id;

    await production.setRouting(other, otherProduct, otherStation);

    const order = await orders.create(otherToken, 'cross-tenant', {
      items: [{ productId: otherProduct, quantity: 1, modifierOptionIds: [] }],
    });

    const item = order.order.items[0];
    expect(item.stationId).toBe(otherStation);

    const tenantItems = await kds.getStationItems(tenant, stationKitchen);
    expect(tenantItems.some((i) => i.id === item.id)).toBe(false);

    const otherItems = await kds.getStationItems(other, otherStation);
    expect(otherItems).toHaveLength(1);
    expect(otherItems[0].id).toBe(item.id);
  });

  it('order status derives from item statuses', async () => {
    const order = await orders.create(token, 'status-derivation', {
      items: [
        { productId: productKitchen, quantity: 1, modifierOptionIds: [] },
        { productId: productBar, quantity: 1, modifierOptionIds: [] },
      ],
    });

    let orderSummary = await kds.getOrderSummary(tenant, order.order.id);
    expect(orderSummary!.order.status).toBe('ACCEPTED');

    const [kitchenItem, barItem] = order.order.items;

    await kds.transitionItem(tenant, kitchenItem.id, 'IN_PREPARATION', 'user-1');
    orderSummary = await kds.getOrderSummary(tenant, order.order.id);
    expect(orderSummary!.order.status).toBe('IN_PRODUCTION');

    await kds.transitionItem(tenant, kitchenItem.id, 'READY', 'user-1');
    orderSummary = await kds.getOrderSummary(tenant, order.order.id);
    expect(orderSummary!.order.status).toBe('IN_PRODUCTION');

    await kds.transitionItem(tenant, barItem.id, 'IN_PREPARATION', 'user-1');
    await kds.transitionItem(tenant, barItem.id, 'READY', 'user-1');
    orderSummary = await kds.getOrderSummary(tenant, order.order.id);
    expect(orderSummary!.order.status).toBe('READY');

    await kds.transitionItem(tenant, kitchenItem.id, 'DELIVERED', 'user-1');
    await kds.transitionItem(tenant, barItem.id, 'DELIVERED', 'user-1');
    orderSummary = await kds.getOrderSummary(tenant, order.order.id);
    expect(orderSummary!.order.status).toBe('COMPLETED');
  });
});