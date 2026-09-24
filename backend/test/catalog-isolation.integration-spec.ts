import { randomUUID } from 'node:crypto';
import { NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import { CatalogService } from '../src/catalog/catalog.service.js';
import { PublicCatalogService } from '../src/catalog/public-catalog.service.js';
import { DatabaseService } from '../src/database/database.service.js';
import { CatalogRepository } from '../src/database/repositories/catalog.repository.js';
import { EntryCredentialRepository } from '../src/database/repositories/entry-credential.repository.js';
import { EntryModeRepository } from '../src/database/repositories/entry-mode.repository.js';
import { ServicePointRepository } from '../src/database/repositories/service-point.repository.js';
import {
  catalogCategories,
  catalogProducts,
  mediaAssets,
  modifierGroups,
  tenantBranding,
} from '../src/database/schema/index.js';
import { EntryCredentialService } from '../src/entry-contexts/entry-credential.service.js';
import { EntryModeService } from '../src/entry-contexts/entry-mode.service.js';
import { QrTokenService } from '../src/entry-contexts/qr-token.service.js';
import { ServicePointService } from '../src/entry-contexts/service-point.service.js';

describe('Tenant catalog and public menu isolation', () => {
  const admin = new Pool({ connectionString: process.env.DATABASE_ADMIN_URL });
  const database = new DatabaseService();
  const repository = new CatalogRepository();
  const catalog = new CatalogService(database, repository);
  const tokens = new QrTokenService();
  const publicCatalog = new PublicCatalogService(database, repository, tokens);
  const modes = new EntryModeService(database, new EntryModeRepository());
  const points = new ServicePointService(
    database,
    new ServicePointRepository(),
    new EntryModeRepository(),
  );
  const credentials = new EntryCredentialService(
    database,
    new EntryCredentialRepository(),
    tokens,
  );
  const tenantA = randomUUID();
  const tenantB = randomUUID();
  let categoryA: string;
  let categoryB: string;
  let productA: string;
  let groupB: string;
  let tokenA: string;

  beforeAll(async () => {
    await admin.query(
      `insert into tenants (id, name, slug) values ($1, 'Catálogo A', $2), ($3, 'Catálogo B', $4)`,
      [tenantA, `catalog-a-${tenantA}`, tenantB, `catalog-b-${tenantB}`],
    );
    await modes.replace(tenantA, { enabledServicePointKinds: ['FIXED_TABLE'] });
    const point = await points.create(tenantA, {
      kind: 'FIXED_TABLE',
      label: 'Mesa 7',
      code: 'M-7',
    });
    tokenA = (await credentials.issue(tenantA, point.id)).token;
    categoryA = (
      await catalog.createCategory(tenantA, { name: 'Pratos', sortOrder: 1 })
    ).id;
    await catalog.createCategory(tenantA, {
      name: 'Oculta',
      active: false,
      sortOrder: 0,
    });
    categoryB = (await catalog.createCategory(tenantB, { name: 'Bebidas B' }))
      .id;
    productA = (
      await catalog.createProduct(tenantA, {
        categoryId: categoryA,
        name: 'Risoto',
        description: '<script>não executar</script>',
        priceMinor: 3200,
        sortOrder: 2,
      })
    ).id;
    await catalog.createProduct(tenantA, {
      categoryId: categoryA,
      name: 'Esgotado',
      priceMinor: 1800,
      available: false,
      sortOrder: 1,
    });
    await catalog.createProduct(tenantA, {
      categoryId: categoryA,
      name: 'Inativo',
      priceMinor: 900,
      active: false,
    });
    const groupA = (
      await catalog.createGroup(tenantA, {
        name: 'Tamanho',
        required: true,
        minSelections: 1,
        maxSelections: 1,
      })
    ).id;
    await catalog.createOption(tenantA, groupA, {
      name: 'Grande',
      priceDeltaMinor: 500,
    });
    await catalog.associateGroup(tenantA, productA, {
      modifierGroupId: groupA,
      sortOrder: 0,
    });
    groupB = (await catalog.createGroup(tenantB, { name: 'Grupo B' })).id;
    await catalog.updateBranding(tenantA, {
      displayName: 'Bistrô A',
      primaryColor: '#A13B2B',
    });
  });

  afterAll(async () => {
    await admin.query('delete from product_media where tenant_id = any($1)', [
      [tenantA, tenantB],
    ]);
    await admin.query(
      'delete from product_modifier_groups where tenant_id = any($1)',
      [[tenantA, tenantB]],
    );
    await admin.query(
      'delete from modifier_options where tenant_id = any($1)',
      [[tenantA, tenantB]],
    );
    await admin.query('delete from modifier_groups where tenant_id = any($1)', [
      [tenantA, tenantB],
    ]);
    await admin.query(
      'delete from catalog_products where tenant_id = any($1)',
      [[tenantA, tenantB]],
    );
    await admin.query(
      'delete from catalog_categories where tenant_id = any($1)',
      [[tenantA, tenantB]],
    );
    await admin.query('delete from tenant_branding where tenant_id = any($1)', [
      [tenantA, tenantB],
    ]);
    await admin.query('delete from media_assets where tenant_id = any($1)', [
      [tenantA, tenantB],
    ]);
    await admin.query(
      'delete from entry_credentials where tenant_id = any($1)',
      [[tenantA, tenantB]],
    );
    await admin.query('delete from service_points where tenant_id = any($1)', [
      [tenantA, tenantB],
    ]);
    await admin.query(
      'delete from tenant_entry_modes where tenant_id = any($1)',
      [[tenantA, tenantB]],
    );
    await admin.query('delete from tenants where id = any($1)', [
      [tenantA, tenantB],
    ]);
    await database.onApplicationShutdown();
    await admin.end();
  });

  it('returns no catalog data without a tenant context', async () => {
    const result = await database.transaction(async (tx) => ({
      categories: await tx.select().from(catalogCategories),
      products: await tx.select().from(catalogProducts),
      groups: await tx.select().from(modifierGroups),
      media: await tx.select().from(mediaAssets),
      branding: await tx.select().from(tenantBranding),
    }));
    expect(result).toEqual({
      categories: [],
      products: [],
      groups: [],
      media: [],
      branding: [],
    });
  });

  it('does not read or update another tenant catalog', async () => {
    expect(
      (await catalog.listCategories(tenantA)).map((row) => row.id),
    ).not.toContain(categoryB);
    await expect(
      catalog.updateCategory(tenantA, categoryB, { name: 'Invadida' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects cross-tenant category, modifier and branding media associations', async () => {
    await expect(
      catalog.createProduct(tenantA, {
        categoryId: categoryB,
        name: 'Cross',
        priceMinor: 100,
      }),
    ).rejects.toMatchObject({ cause: { code: '23503' } });
    await expect(
      catalog.associateGroup(tenantA, productA, { modifierGroupId: groupB }),
    ).rejects.toMatchObject({ cause: { code: '23503' } });
    const mediaB = (
      await database.withTenantContext(tenantB, (tx) =>
        repository.createMedia(tx, tenantB, {
          storageKey: `${randomUUID()}.png`,
          mimeType: 'image/png',
          sizeBytes: 20,
        }),
      )
    )[0];
    await expect(
      catalog.updateBranding(tenantA, {
        displayName: 'A',
        primaryColor: '#112233',
        logoMediaId: mediaB.id,
      }),
    ).rejects.toMatchObject({ cause: { code: '23503' } });
  });

  it('builds the public menu from a valid entry without creating a service session', async () => {
    const result = await publicCatalog.get(tokenA);
    expect(result.establishment).toMatchObject({
      displayName: 'Bistrô A',
      primaryColor: '#A13B2B',
    });
    expect(result.entry.servicePoint).toEqual({
      kind: 'FIXED_TABLE',
      label: 'Mesa 7',
    });
    expect(result.categories.map((category) => category.name)).toEqual([
      'Pratos',
    ]);
    expect(
      result.categories[0].products.map((product) => [
        product.name,
        product.available,
      ]),
    ).toEqual([
      ['Esgotado', false],
      ['Risoto', true],
    ]);
    expect(JSON.stringify(result)).not.toMatch(
      /tenant_id|tenantId|token_hash|credential|capabilit/,
    );
  });

  it('uses a uniform not-found response for invalid or inactive contexts', async () => {
    await expect(publicCatalog.get('invalid')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await admin.query(`update tenants set status = 'SUSPENDED' where id = $1`, [
      tenantA,
    ]);
    await expect(publicCatalog.get(tokenA)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await admin.query(`update tenants set status = 'ACTIVE' where id = $1`, [
      tenantA,
    ]);
  });
});
