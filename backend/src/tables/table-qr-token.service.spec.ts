import {
  TABLE_QR_TOKEN_PATTERN,
  TableQrTokenService,
} from './table-qr-token.service.js';
describe('TableQrTokenService', () => {
  const service = new TableQrTokenService();
  it('generates a 256-bit base64url token and a SHA-256 hash', () => {
    const generated = service.generate();
    expect(generated.token).toMatch(TABLE_QR_TOKEN_PATTERN);
    expect(Buffer.from(generated.token, 'base64url')).toHaveLength(32);
    expect(generated.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(generated.hash).not.toContain(generated.token);
  });
  it('rejects malformed tokens before hashing', () => {
    expect(() => service.hash('short-or-invalid')).toThrow(
      'Invalid table QR token.',
    );
  });
});
