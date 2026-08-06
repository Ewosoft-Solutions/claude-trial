import { Module } from '@nestjs/common';
import { CommonModule } from '../common';
import { AuthModule } from '../auth/auth.module';
import { FinanceController } from './controllers/finance.controller';
import { FinanceAdjustmentController } from './controllers/finance-adjustment.controller';
import { FinanceService } from './services/finance.service';
import { FinanceAdjustmentService } from './services/finance-adjustment.service';

@Module({
  imports: [CommonModule, AuthModule],
  controllers: [FinanceController, FinanceAdjustmentController],
  providers: [FinanceService, FinanceAdjustmentService],
  exports: [FinanceService, FinanceAdjustmentService],
})
export class FinanceModule {}
