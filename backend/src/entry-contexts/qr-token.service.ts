import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
export const QR_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
@Injectable()
export class QrTokenService {
  generate(): { token: string; hash: string } {
    const token = randomBytes(32).toString('base64url');
    return { token, hash: this.hash(token) };
  }
  hash(token: string): string {
    if (!QR_TOKEN_PATTERN.test(token))
      throw new Error('Invalid QR token.');
    return createHash('sha256').update(token, 'ascii').digest('hex');
  }
}
