import { Module } from '@nestjs/common';

import { CommonModule } from '../common';
import { AuthModule } from '../auth/auth.module';
import { DocumentsModule } from '../documents/documents.module';
import { CommunicationModule } from '../communication/communication.module';

import { ResultCycleService } from './services/result-cycle.service';
import { ResultEntryService } from './services/result-entry.service';
import { ResultPublicationService } from './services/result-publication.service';
import { ResultArtifactService } from './services/result-artifact.service';
import { FinancialHoldService } from './services/financial-hold.service';

import { ResultCycleController } from './controllers/result-cycle.controller';
import { ResultEntryController } from './controllers/result-entry.controller';
import { ResultPublicationController } from './controllers/result-publication.controller';
import { FinancialHoldController } from './controllers/financial-hold.controller';

/**
 * WB4 · Results parity / ResultCycle (ADR-04). The immutable result-publication
 * workbench: configure a cycle, capture component scores, moderate, publish an
 * immutable snapshot (maker-checker) with report-card/broadsheet artifacts,
 * amend by supersession, and gate visibility with audited FinancialHolds. Reuses
 * F4 documents/signatures, F5 delivery, and the WB1-6 maker-checker + scope.
 */
@Module({
  imports: [CommonModule, AuthModule, DocumentsModule, CommunicationModule],
  controllers: [
    ResultCycleController,
    ResultEntryController,
    ResultPublicationController,
    FinancialHoldController,
  ],
  providers: [
    ResultCycleService,
    ResultEntryService,
    ResultPublicationService,
    ResultArtifactService,
    FinancialHoldService,
  ],
  exports: [ResultCycleService, ResultPublicationService, FinancialHoldService],
})
export class ResultsModule {}
