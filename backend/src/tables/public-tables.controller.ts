import { Controller, Get, Param } from '@nestjs/common';
import { TableQrService } from './table-qr.service.js';
@Controller('public/table')
export class PublicTablesController {
  constructor(private readonly qr: TableQrService) {}
  @Get(':token') resolve(@Param('token') token: string) {
    return this.qr.resolvePublic(token);
  }
}
