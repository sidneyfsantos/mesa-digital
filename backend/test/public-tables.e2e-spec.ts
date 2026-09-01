import { INestApplication, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { PublicTablesController } from '../src/tables/public-tables.controller.js';
import { TableQrService } from '../src/tables/table-qr.service.js';

describe('Public table QR endpoint (e2e)', () => {
  let app: INestApplication;
  const validToken = 'A'.repeat(43);
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [PublicTablesController],
      providers: [
        {
          provide: TableQrService,
          useValue: {
            resolvePublic: (token: string) => {
              if (token !== validToken)
                throw new NotFoundException('QR credential not found.');
              return {
                establishment: { name: 'Public Tenant' },
                table: { label: 'Mesa 10' },
              };
            },
          },
        },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });
  afterAll(() => app.close());
  it('returns only the minimal public context for a valid token', async () => {
    const response = await request(app.getHttpServer())
      .get(`/public/table/${validToken}`)
      .expect(200);
    expect(response.body).toEqual({
      establishment: { name: 'Public Tenant' },
      table: { label: 'Mesa 10' },
    });
    expect(JSON.stringify(response.body)).not.toMatch(
      /tenantId|tableId|token|hash|active/,
    );
  });
  it('uses the same safe response for malformed and unknown/revoked tokens', async () => {
    const malformed = await request(app.getHttpServer())
      .get('/public/table/invalid')
      .expect(404);
    const unavailable = await request(app.getHttpServer())
      .get(`/public/table/${'B'.repeat(43)}`)
      .expect(404);
    expect(malformed.body).toEqual(unavailable.body);
    expect(malformed.body.message).toBe('QR credential not found.');
  });
});
