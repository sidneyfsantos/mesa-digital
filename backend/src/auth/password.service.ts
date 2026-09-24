import { Injectable } from '@nestjs/common';
import {
  randomBytes,
  scrypt as callbackScrypt,
  timingSafeEqual,
} from 'node:crypto';
const scrypt = (
  value: string,
  salt: Buffer,
  length: number,
  options: Parameters<typeof callbackScrypt>[3],
) =>
  new Promise<Buffer>((resolve, reject) =>
    callbackScrypt(value, salt, length, options, (error, derived) =>
      error ? reject(error) : resolve(derived),
    ),
  );
@Injectable()
export class PasswordService {
  async hash(value: string) {
    if (value.length < 12)
      throw new Error('Password must have at least 12 characters.');
    const salt = randomBytes(16);
    const derived = await scrypt(value, salt, 64, {
      N: 32768,
      r: 8,
      p: 1,
      maxmem: 64 * 1024 * 1024,
    });
    return `scrypt$32768$8$1$${salt.toString('base64')}$${derived.toString('base64')}`;
  }
  async verify(value: string, encoded: string) {
    try {
      const [kind, n, r, p, salt, hash] = encoded.split('$');
      if (kind !== 'scrypt') return false;
      const expected = Buffer.from(hash, 'base64');
      const actual = await scrypt(
        value,
        Buffer.from(salt, 'base64'),
        expected.length,
        { N: Number(n), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024 },
      );
      return timingSafeEqual(actual, expected);
    } catch {
      return false;
    }
  }
}
