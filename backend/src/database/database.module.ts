import { Global, Module } from '@nestjs/common';
import { DatabaseService } from './database.service.js';
import { EntryCredentialRepository } from './repositories/entry-credential.repository.js';
import { EntryModeRepository } from './repositories/entry-mode.repository.js';
import { ServicePointRepository } from './repositories/service-point.repository.js';
import { CatalogRepository } from './repositories/catalog.repository.js';
import { AccessRepository } from './repositories/access.repository.js';
import { TenantUserRepository } from './repositories/tenant-user.repository.js';

@Global()
@Module({
  providers: [
    DatabaseService,
    AccessRepository,
    CatalogRepository,
    ServicePointRepository,
    EntryCredentialRepository,
    EntryModeRepository,
    TenantUserRepository,
  ],
  exports: [
    DatabaseService,
    AccessRepository,
    CatalogRepository,
    ServicePointRepository,
    EntryCredentialRepository,
    EntryModeRepository,
    TenantUserRepository,
  ],
})
export class DatabaseModule {}
