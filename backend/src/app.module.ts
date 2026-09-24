import { Module } from '@nestjs/common';
import { EntryContextsModule } from './entry-contexts/entry-contexts.module.js';
import { AuthModule } from './auth/auth.module.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { DatabaseModule } from './database/database.module.js';

@Module({
  imports: [DatabaseModule, AuthModule, EntryContextsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
