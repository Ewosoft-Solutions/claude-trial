import { Module } from '@nestjs/common';
import { CommonModule } from '../common';
import { AuthModule } from '../auth/auth.module';
import { HealthController } from './controllers/health.controller';
import { HealthService } from './services/health.service';
import { HealthFlagsService } from './services/health-flags.service';

@Module({
  imports: [CommonModule, AuthModule],
  controllers: [HealthController],
  providers: [HealthService, HealthFlagsService],
  exports: [HealthService, HealthFlagsService],
})
export class HealthModule {}
