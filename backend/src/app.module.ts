import { Module } from '@nestjs/common';
import { CatalogModule } from './catalog/catalog.module.js';
import { EntryContextsModule } from './entry-contexts/entry-contexts.module.js';
import { AuthModule } from './auth/auth.module.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { DatabaseModule } from './database/database.module.js';
import { OrderingModule } from './ordering/ordering.module.js';

@Module({
  imports: [CatalogModule, DatabaseModule, AuthModule, EntryContextsModule, OrderingModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
