import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { CatalogRepository } from '../database/repositories/catalog.repository.js';
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const text = (value: unknown, max: number, required = true) => {
  if (value === null && !required) return null;
  const result = typeof value === 'string' ? value.trim() : '';
  if ((required && !result) || result.length > max)
    throw new BadRequestException('Invalid text field.');
  return result || null;
};
const integer = (value: unknown, min = 0) => {
  if (!Number.isSafeInteger(value) || Number(value) < min)
    throw new BadRequestException('Invalid numeric field.');
  return Number(value);
};
const bool = (value: unknown) => {
  if (typeof value !== 'boolean')
    throw new BadRequestException('Invalid boolean field.');
  return value;
};
@Injectable()
export class CatalogService {
  constructor(
    private readonly database: DatabaseService,
    private readonly repo: CatalogRepository,
  ) {}
  listCategories(t: string) {
    return this.database.withTenantContext(t, (tx) =>
      this.repo.categories(tx, t),
    );
  }
  createCategory(t: string, input: any) {
    const data = this.category(input, true);
    return this.database.withTenantContext(
      t,
      async (tx) => (await this.repo.createCategory(tx, t, data))[0],
    );
  }
  updateCategory(t: string, id: string, input: any) {
    this.id(id);
    const data = this.category(input, false);
    return this.database.withTenantContext(t, async (tx) => {
      const row = (await this.repo.updateCategory(tx, t, id, data))[0];
      if (!row) throw new NotFoundException('Category not found.');
      return row;
    });
  }
  listProducts(t: string) {
    return this.database.withTenantContext(t, (tx) =>
      this.repo.products(tx, t),
    );
  }
  createProduct(t: string, input: any) {
    const data = this.product(input, true);
    return this.database.withTenantContext(
      t,
      async (tx) => (await this.repo.createProduct(tx, t, data))[0],
    );
  }
  updateProduct(t: string, id: string, input: any) {
    this.id(id);
    const data = this.product(input, false);
    return this.database.withTenantContext(t, async (tx) => {
      const row = (await this.repo.updateProduct(tx, t, id, data))[0];
      if (!row) throw new NotFoundException('Product not found.');
      return row;
    });
  }
  listGroups(t: string) {
    return this.database.withTenantContext(t, async (tx) => ({
      groups: await this.repo.groups(tx, t),
      options: await this.repo.options(tx, t),
    }));
  }
  createGroup(t: string, input: any) {
    const data = this.group(input, true);
    return this.database.withTenantContext(
      t,
      async (tx) => (await this.repo.createGroup(tx, t, data))[0],
    );
  }
  updateGroup(t: string, id: string, input: any) {
    this.id(id);
    const data = this.group(input, false);
    return this.database.withTenantContext(t, async (tx) => {
      const row = (await this.repo.updateGroup(tx, t, id, data))[0];
      if (!row) throw new NotFoundException('Modifier group not found.');
      return row;
    });
  }
  createOption(t: string, groupId: string, input: any) {
    this.id(groupId);
    const data = { groupId, ...this.option(input, true) };
    return this.database.withTenantContext(
      t,
      async (tx) => (await this.repo.createOption(tx, t, data))[0],
    );
  }
  updateOption(t: string, id: string, input: any) {
    this.id(id);
    const data = this.option(input, false);
    return this.database.withTenantContext(t, async (tx) => {
      const row = (await this.repo.updateOption(tx, t, id, data))[0];
      if (!row) throw new NotFoundException('Modifier option not found.');
      return row;
    });
  }
  associateGroup(t: string, productId: string, input: any) {
    this.id(productId);
    this.id(input?.modifierGroupId);
    const order = integer(input?.sortOrder ?? 0);
    return this.database.withTenantContext(
      t,
      async (tx) =>
        (
          await this.repo.associateGroup(
            tx,
            t,
            productId,
            input.modifierGroupId,
            order,
          )
        )[0],
    );
  }
  attachMedia(t: string, productId: string, input: any) {
    this.id(productId);
    this.id(input?.mediaId);
    const order = integer(input?.sortOrder ?? 0);
    return this.database.withTenantContext(
      t,
      async (tx) =>
        (
          await this.repo.attachMedia(tx, t, productId, input.mediaId, order)
        )[0],
    );
  }
  async getBranding(t: string) {
    const row = await this.database.withTenantContext(t, (tx) =>
      this.repo.branding(tx, t),
    );
    return row[0] ?? null;
  }
  updateBranding(t: string, input: any) {
    const displayName = text(input?.displayName, 160);
    const primaryColor =
      typeof input?.primaryColor === 'string'
        ? input.primaryColor.toUpperCase()
        : '';
    if (!/^#[0-9A-F]{6}$/.test(primaryColor))
      throw new BadRequestException('Invalid primary color.');
    for (const key of ['logoMediaId', 'coverMediaId'])
      if (input?.[key] != null) this.id(input[key]);
    return this.database.withTenantContext(
      t,
      async (tx) =>
        (
          await this.repo.upsertBranding(tx, t, {
            displayName,
            primaryColor,
            logoMediaId: input.logoMediaId ?? null,
            coverMediaId: input.coverMediaId ?? null,
          })
        )[0],
    );
  }
  private category(i: any, create: boolean) {
    const d: any = {};
    if (create || i.name !== undefined) d.name = text(i?.name, 100);
    if (i.description !== undefined)
      d.description = text(i.description, 1000, false);
    if (create || i.active !== undefined)
      d.active = i.active === undefined ? true : bool(i.active);
    if (create || i.sortOrder !== undefined)
      d.sortOrder = integer(i.sortOrder ?? 0);
    if (!create && !Object.keys(d).length)
      throw new BadRequestException('No changes supplied.');
    return d;
  }
  private product(i: any, create: boolean) {
    const d: any = {};
    if (create || i.categoryId !== undefined) {
      this.id(i?.categoryId);
      d.categoryId = i.categoryId;
    }
    if (create || i.name !== undefined) d.name = text(i?.name, 140);
    if (i.description !== undefined)
      d.description = text(i.description, 3000, false);
    if (create || i.priceMinor !== undefined)
      d.priceMinor = integer(i?.priceMinor);
    if (create || i.active !== undefined)
      d.active = i.active === undefined ? true : bool(i.active);
    if (create || i.available !== undefined)
      d.available = i.available === undefined ? true : bool(i.available);
    if (create || i.sortOrder !== undefined)
      d.sortOrder = integer(i.sortOrder ?? 0);
    if (!create && !Object.keys(d).length)
      throw new BadRequestException('No changes supplied.');
    return d;
  }
  private group(i: any, create: boolean) {
    const d: any = {};
    if (create || i.name !== undefined) d.name = text(i?.name, 100);
    if (create || i.required !== undefined)
      d.required = i.required === undefined ? false : bool(i.required);
    if (create || i.minSelections !== undefined)
      d.minSelections = integer(i.minSelections ?? 0);
    if (create || i.maxSelections !== undefined)
      d.maxSelections = integer(i.maxSelections ?? 1, 1);
    const min = d.minSelections ?? i.minSelections,
      max = d.maxSelections ?? i.maxSelections,
      required = d.required ?? i.required;
    if (min !== undefined && max !== undefined && min > max)
      throw new BadRequestException('Minimum cannot exceed maximum.');
    if (required === true && min === 0)
      throw new BadRequestException(
        'Required groups need at least one selection.',
      );
    if (create || i.active !== undefined)
      d.active = i.active === undefined ? true : bool(i.active);
    if (create || i.sortOrder !== undefined)
      d.sortOrder = integer(i.sortOrder ?? 0);
    return d;
  }
  private option(i: any, create: boolean) {
    const d: any = {};
    if (create || i.name !== undefined) d.name = text(i?.name, 100);
    if (create || i.priceDeltaMinor !== undefined)
      d.priceDeltaMinor = integer(i.priceDeltaMinor ?? 0);
    if (create || i.active !== undefined)
      d.active = i.active === undefined ? true : bool(i.active);
    if (create || i.sortOrder !== undefined)
      d.sortOrder = integer(i.sortOrder ?? 0);
    return d;
  }
  private id(value: unknown) {
    if (typeof value !== 'string' || !UUID.test(value))
      throw new BadRequestException('Invalid identifier.');
  }
}
