import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
@Injectable()
export class LoginRateLimitService {
  private attempts = new Map<string, { count: number; reset: number }>();
  check(key: string) {
    const now = Date.now(),
      current = this.attempts.get(key);
    if (!current || current.reset < now) {
      this.attempts.set(key, { count: 1, reset: now + 15 * 60_000 });
      return;
    }
    if (current.count >= 5)
      throw new HttpException(
        'Too many login attempts.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    current.count++;
  }
  clear(key: string) {
    this.attempts.delete(key);
  }
}
