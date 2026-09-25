import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { CatalogModule } from './catalog/catalog.module.js';
import { DatabaseModule } from './database/database.module.js';
import { EntryContextsModule } from './entry-contexts/entry-contexts.module.js';
import { OnboardingModule } from './onboarding/onboarding.module.js';
import { OrderingModule } from './ordering/ordering.module.js';
import { ProductionModule } from './production/production.module.js';
import { RealtimeModule } from './realtime/realtime.module.js';
import { ServiceSessionModule } from './service-session/service-session.module.js';

@Module({
  imports: [
    CatalogModule,
    DatabaseModule,
    AuthModule,
    EntryContextsModule,
    OnboardingModule,
    OrderingModule,
    ProductionModule,
    RealtimeModule,
    ServiceSessionModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}