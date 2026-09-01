import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import { DatabaseService } from './database.service.js';

const application = await NestFactory.createApplicationContext(AppModule, {
  logger: false,
});

try {
  await application.get(DatabaseService).ping();
  process.stdout.write('Database connection: OK\n');
} finally {
  await application.close();
}
