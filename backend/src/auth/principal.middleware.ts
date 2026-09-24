import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Response } from 'express';
import { AuthenticationService } from './authentication.service.js';
import { sessionToken } from './auth.controller.js';
import type { PrincipalRequest } from './principal.js';
@Injectable()
export class PrincipalMiddleware implements NestMiddleware {
  constructor(private auth: AuthenticationService) {}
  async use(req: PrincipalRequest & any, _res: Response, next: NextFunction) {
    req.principal = await this.auth.resolve(sessionToken(req));
    next();
  }
}
