import { Module } from '@nestjs/common';
import { CommonModule } from '../common';
import { AuthModule } from '../auth/auth.module';
import { FinanceController } from './controllers/finance.controller';
import { FinanceAdjustmentController } from './controllers/finance-adjustment.controller';
import { FinanceCatalogueController } from './controllers/finance-catalogue.controller';
import { FinanceService } from './services/finance.service';
import { FinanceAdjustmentService } from './services/finance-adjustment.service';
import { FinanceCatalogueService } from './services/finance-catalogue.service';

@Module({
  imports: [CommonModule, AuthModule],
  controllers: [
    FinanceController,
    FinanceAdjustmentController,
    FinanceCatalogueController,
  ],
  providers: [
    FinanceService,
    FinanceAdjustmentService,
    FinanceCatalogueService,
  ],
  exports: [
    FinanceService,
    FinanceAdjustmentService,
    FinanceCatalogueService,
  ],
})
export class FinanceModule {}
