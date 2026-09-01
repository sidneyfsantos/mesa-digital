import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
export const TABLE_QR_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
@Injectable()
export class TableQrTokenService {
  generate(): { token: string; hash: string } {
    const token = randomBytes(32).toString('base64url');
    return { token, hash: this.hash(token) };
  }
  hash(token: string): string {
    if (!TABLE_QR_TOKEN_PATTERN.test(token))
      throw new Error('Invalid table QR token.');
    return createHash('sha256').update(token, 'ascii').digest('hex');
  }
}
