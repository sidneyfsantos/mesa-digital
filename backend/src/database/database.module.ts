import { Global, Module } from '@nestjs/common';
import { DatabaseService } from './database.service.js';
import { TenantUserRepository } from './repositories/tenant-user.repository.js';

@Global()
@Module({
  providers: [DatabaseService, TenantUserRepository],
  exports: [DatabaseService, TenantUserRepository],
})
export class DatabaseModule {}
