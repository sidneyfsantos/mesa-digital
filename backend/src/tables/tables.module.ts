import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PublicTablesController } from './public-tables.controller.js';
import { TableQrTokenService } from './table-qr-token.service.js';
import { TableQrService } from './table-qr.service.js';
import { TableService } from './table.service.js';
import { TablesController } from './tables.controller.js';
@Module({
  imports: [AuthModule],
  controllers: [TablesController, PublicTablesController],
  providers: [TableService, TableQrService, TableQrTokenService],
})
export class TablesModule {}
