import { Module } from '@nestjs/common';
import { CommonModule } from '../common';
import { AuthModule } from '../auth/auth.module';
import { FinanceController } from './controllers/finance.controller';
import { FinanceAdjustmentController } from './controllers/finance-adjustment.controller';
import { FinanceCatalogueController } from './controllers/finance-catalogue.controller';
import { FinanceHouseholdController } from './controllers/finance-household.controller';
import { FinanceLedgerController } from './controllers/finance-ledger.controller';
import { FinanceReportController } from './controllers/finance-report.controller';
import { FinanceService } from './services/finance.service';
import { FinanceAdjustmentService } from './services/finance-adjustment.service';
import { FinanceCatalogueService } from './services/finance-catalogue.service';
import { FinanceHouseholdService } from './services/finance-household.service';
import { FinanceNumberingService } from './services/finance-numbering.service';
import { FinanceReceiptService } from './services/finance-receipt.service';
import { FinanceCreditService } from './services/finance-credit.service';
import { FinanceReportingService } from './services/finance-reporting.service';
import { LedgerService } from './services/ledger.service';

@Module({
  imports: [CommonModule, AuthModule],
  controllers: [
    FinanceController,
    FinanceAdjustmentController,
    FinanceCatalogueController,
    FinanceHouseholdController,
    FinanceLedgerController,
    FinanceReportController,
  ],
  providers: [
    FinanceService,
    FinanceAdjustmentService,
    FinanceCatalogueService,
    FinanceHouseholdService,
    FinanceNumberingService,
    FinanceReceiptService,
    FinanceCreditService,
    FinanceReportingService,
    LedgerService,
  ],
  exports: [
    FinanceService,
    FinanceAdjustmentService,
    FinanceCatalogueService,
    FinanceHouseholdService,
    FinanceNumberingService,
    FinanceReceiptService,
    FinanceCreditService,
    FinanceReportingService,
    LedgerService,
  ],
})
export class FinanceModule {}
