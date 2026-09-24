import { describe, expect, it } from 'vitest';
import { PasswordService } from './password.service.js';
describe('PasswordService', () => {
  const service = new PasswordService();
  it('hashes with a random salt and verifies without storing plaintext', async () => {
    const a = await service.hash('correct horse battery staple');
    const b = await service.hash('correct horse battery staple');
    expect(a).not.toBe(b);
    expect(a).not.toContain('correct horse');
    await expect(
      service.verify('correct horse battery staple', a),
    ).resolves.toBe(true);
    await expect(service.verify('wrong password', a)).resolves.toBe(false);
  });
});
