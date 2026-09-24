import { INestApplication, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { MediaService } from '../src/catalog/media.service.js';
import { PublicCatalogController } from '../src/catalog/public-catalog.controller.js';
import { PublicCatalogService } from '../src/catalog/public-catalog.service.js';

describe('Public catalog endpoint (e2e)', () => {
  let app: INestApplication;
  const validToken = 'C'.repeat(43);
  const catalog = {
    establishment: {
      displayName: 'Bistrô',
      primaryColor: '#AA3311',
      logoUrl: null,
      coverUrl: null,
    },
    entry: {
      kind: 'QR',
      servicePoint: { kind: 'MOBILE_TAB', label: 'Comanda 8' },
    },
    categories: [],
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [PublicCatalogController],
      providers: [
        {
          provide: PublicCatalogService,
          useValue: {
            get: (token: string) => {
              if (token !== validToken)
                throw new NotFoundException('Catalog not found.');
              return catalog;
            },
          },
        },
        {
          provide: MediaService,
          useValue: {
            read: async () => Buffer.from('image'),
            mime: () => 'image/png',
          },
        },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });
  afterAll(() => app.close());

  it('returns only the public menu projection and disables shared caching', async () => {
    const response = await request(app.getHttpServer())
      .get(`/public/entry/${validToken}/catalog`)
      .expect(200);
    expect(response.body).toEqual(catalog);
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(JSON.stringify(response.body)).not.toMatch(
      /tenantId|hash|credential|user|capabilit|audit/,
    );
  });

  it('does not distinguish malformed and unavailable entry credentials', async () => {
    const malformed = await request(app.getHttpServer())
      .get('/public/entry/invalid/catalog')
      .expect(404);
    const unavailable = await request(app.getHttpServer())
      .get(`/public/entry/${'D'.repeat(43)}/catalog`)
      .expect(404);
    expect(malformed.body).toEqual(unavailable.body);
  });
});
