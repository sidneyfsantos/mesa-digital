import { Global, Module } from '@nestjs/common';
import { DatabaseService } from './database.service.js';
import { TableQrRepository } from './repositories/table-qr.repository.js';
import { TableRepository } from './repositories/table.repository.js';
import { AccessRepository } from './repositories/access.repository.js';
import { TenantUserRepository } from './repositories/tenant-user.repository.js';

@Global()
@Module({
  providers: [
    DatabaseService,
    AccessRepository,
    TableRepository,
    TableQrRepository,
    TenantUserRepository,
  ],
  exports: [
    DatabaseService,
    AccessRepository,
    TableRepository,
    TableQrRepository,
    TenantUserRepository,
  ],
})
export class DatabaseModule {}
