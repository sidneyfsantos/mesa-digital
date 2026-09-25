import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { RealtimeController } from './realtime.controller.js';

@Module({
  imports: [AuthModule],
  controllers: [RealtimeController],
})
export class RealtimeModule {}