import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { CatalogService } from './catalog.service.js';

const database = { withTenantContext: vi.fn() };
const repository = {};
const service = new CatalogService(database as never, repository as never);

describe('CatalogService validation', () => {
  it('rejects fractional and negative monetary values', () => {
    expect(() =>
      service.createProduct('tenant', {
        categoryId: crypto.randomUUID(),
        name: 'Produto',
        priceMinor: 10.5,
      }),
    ).toThrow(BadRequestException);
    expect(() =>
      service.createProduct('tenant', {
        categoryId: crypto.randomUUID(),
        name: 'Produto',
        priceMinor: -1,
      }),
    ).toThrow(BadRequestException);
  });

  it('keeps active and available as independent booleans', () => {
    expect(() =>
      service.createProduct('tenant', {
        categoryId: crypto.randomUUID(),
        name: 'Produto',
        priceMinor: 100,
        active: true,
        available: false,
      }),
    ).not.toThrow();
    expect(database.withTenantContext).toHaveBeenCalled();
  });

  it('enforces coherent modifier limits and required groups', () => {
    expect(() =>
      service.createGroup('tenant', {
        name: 'Escolhas',
        minSelections: 2,
        maxSelections: 1,
      }),
    ).toThrow(BadRequestException);
    expect(() =>
      service.createGroup('tenant', {
        name: 'Escolhas',
        required: true,
        minSelections: 0,
        maxSelections: 1,
      }),
    ).toThrow(BadRequestException);
  });

  it('accepts only a constrained hexadecimal brand color', () => {
    expect(() =>
      service.updateBranding('tenant', {
        displayName: 'Loja',
        primaryColor: 'red',
      }),
    ).toThrow(BadRequestException);
    expect(() =>
      service.updateBranding('tenant', {
        displayName: 'Loja',
        primaryColor: '#12abEF',
      }),
    ).not.toThrow();
  });
});
