import { Global, Module } from '@nestjs/common';
import { DatabaseService } from './database.service.js';
import { AccessRepository } from './repositories/access.repository.js';
import { TenantUserRepository } from './repositories/tenant-user.repository.js';

@Global()
@Module({
  providers: [DatabaseService, AccessRepository, TenantUserRepository],
  exports: [DatabaseService, AccessRepository, TenantUserRepository],
})
export class DatabaseModule {}
