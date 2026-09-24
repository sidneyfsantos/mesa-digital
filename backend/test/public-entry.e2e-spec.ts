import { INestApplication, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { PublicEntryController } from '../src/entry-contexts/public-entry.controller.js';
import { EntryCredentialService } from '../src/entry-contexts/entry-credential.service.js';
describe('Public entry QR endpoint (e2e)', () => {
  let app: INestApplication; const validToken = 'A'.repeat(43);
  beforeAll(async () => {
    const module = await Test.createTestingModule({ controllers: [PublicEntryController], providers: [{ provide: EntryCredentialService, useValue: { resolvePublic: (token: string) => { if (token !== validToken) throw new NotFoundException('Entry credential not found.'); return { establishment: { name: 'Public Tenant' }, entry: { kind: 'QR', servicePoint: { kind: 'MOBILE_TAB', label: 'Comanda 10' } } }; } } }] }).compile();
    app = module.createNestApplication(); await app.init();
  });
  afterAll(() => app.close());
  it('returns only the minimal public entry context for a valid token', async () => {
    const response = await request(app.getHttpServer()).get(`/public/entry/${validToken}`).expect(200);
    expect(response.body).toEqual({ establishment: { name: 'Public Tenant' }, entry: { kind: 'QR', servicePoint: { kind: 'MOBILE_TAB', label: 'Comanda 10' } } });
    expect(JSON.stringify(response.body)).not.toMatch(/tenantId|servicePointId|token|hash|active/);
  });
  it('uses the same safe response for malformed and unavailable tokens', async () => {
    const malformed = await request(app.getHttpServer()).get('/public/entry/invalid').expect(404);
    const unavailable = await request(app.getHttpServer()).get(`/public/entry/${'B'.repeat(43)}`).expect(404);
    expect(malformed.body).toEqual(unavailable.body); expect(malformed.body.message).toBe('Entry credential not found.');
  });
});
