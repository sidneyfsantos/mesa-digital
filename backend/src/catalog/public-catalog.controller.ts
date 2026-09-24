import { Controller, Get, Header, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { MediaService } from './media.service.js';
import { PublicCatalogService } from './public-catalog.service.js';
@Controller('public')
export class PublicCatalogController {
  constructor(
    private readonly catalog: PublicCatalogService,
    private readonly media: MediaService,
  ) {}
  @Get('entry/:token/catalog')
  @Header('Cache-Control', 'private, no-store')
  get(@Param('token') token: string) {
    return this.catalog.get(token);
  }
  @Get('media/:storageKey') async image(
    @Param('storageKey') key: string,
    @Res() res: Response,
  ) {
    const body = await this.media.read(key);
    res.setHeader('Content-Type', this.media.mime(key));
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(body);
  }
}
