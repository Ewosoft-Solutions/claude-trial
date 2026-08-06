import { Module } from '@nestjs/common';
import { CommonModule } from '../common';
import { AuthModule } from '../auth/auth.module';
import { FinanceController } from './controllers/finance.controller';
import { FinanceAdjustmentController } from './controllers/finance-adjustment.controller';
import { FinanceCatalogueController } from './controllers/finance-catalogue.controller';
import { FinanceHouseholdController } from './controllers/finance-household.controller';
import { FinanceService } from './services/finance.service';
import { FinanceAdjustmentService } from './services/finance-adjustment.service';
import { FinanceCatalogueService } from './services/finance-catalogue.service';
import { FinanceHouseholdService } from './services/finance-household.service';

@Module({
  imports: [CommonModule, AuthModule],
  controllers: [
    FinanceController,
    FinanceAdjustmentController,
    FinanceCatalogueController,
    FinanceHouseholdController,
  ],
  providers: [
    FinanceService,
    FinanceAdjustmentService,
    FinanceCatalogueService,
    FinanceHouseholdService,
  ],
  exports: [
    FinanceService,
    FinanceAdjustmentService,
    FinanceCatalogueService,
    FinanceHouseholdService,
  ],
})
export class FinanceModule {}
