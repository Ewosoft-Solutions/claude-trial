import { Module } from '@nestjs/common';
import { CommonModule } from '../common';
import { AuthModule } from '../auth/auth.module';
import { OverviewController } from './controllers/overview.controller';
import { OverviewService } from './services/overview.service';

@Module({
  imports: [CommonModule, AuthModule],
  controllers: [OverviewController],
  providers: [OverviewService],
  exports: [OverviewService],
})
export class OverviewModule {}
