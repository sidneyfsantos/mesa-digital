import { Body, Controller, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthenticationService } from './authentication.service.js';
import { LoginRateLimitService } from './login-rate-limit.service.js';
const cookie = 'mesa_session';
const token = (req: Request) =>
  req.headers.cookie
    ?.split(';')
    .map((v) => v.trim())
    .find((v) => v.startsWith(`${cookie}=`))
    ?.slice(cookie.length + 1);
@Controller('auth')
export class AuthController {
  constructor(
    private auth: AuthenticationService,
    private limits: LoginRateLimitService,
  ) {}
  @Post('login') async login(
    @Body() b: any,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const key = `${req.ip}:${String(b?.email).trim().toLowerCase()}`;
    this.limits.check(key);
    const result = await this.auth.login(b?.email, b?.password, b?.tenantSlug);
    this.limits.clear(key);
    res.cookie(cookie, result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      expires: result.expiresAt,
    });
    return { authenticated: true };
  }
  @Post('logout') async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const value = token(req);
    if (value) await this.auth.logout(value);
    res.clearCookie(cookie, { path: '/' });
    return { authenticated: false };
  }
}
export { token as sessionToken };
