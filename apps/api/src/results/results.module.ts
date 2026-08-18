import { Module } from '@nestjs/common';

import { CommonModule } from '../common';
import { AuthModule } from '../auth/auth.module';
import { DocumentsModule } from '../documents/documents.module';
import { CommunicationModule } from '../communication/communication.module';
import { JobsModule } from '../common/jobs/jobs.module';
import { PersonModule } from '../person/person.module';

import { ResultCycleService } from './services/result-cycle.service';
import { ResultEntryService } from './services/result-entry.service';
import { ResultPublicationService } from './services/result-publication.service';
import { ResultTraitService } from './services/result-trait.service';
import { ResultImportService } from './services/result-import.service';
import { ResultTranscriptService } from './services/result-transcript.service';
import { ResultArtifactService } from './services/result-artifact.service';
import { FinancialHoldService } from './services/financial-hold.service';
import { ResultsJobRegistrar } from './jobs/results-job.registrar';

import { ResultCycleController } from './controllers/result-cycle.controller';
import { ResultEntryController } from './controllers/result-entry.controller';
import { ResultPublicationController } from './controllers/result-publication.controller';
import { ResultTraitController } from './controllers/result-trait.controller';
import { ResultTranscriptController } from './controllers/result-transcript.controller';
import { FinancialHoldController } from './controllers/financial-hold.controller';

/**
 * WB4 · Results parity / ResultCycle (ADR-04). The immutable result-publication
 * workbench: configure a cycle, capture component scores, moderate, publish an
 * immutable snapshot (maker-checker) — with report-card/broadsheet artifacts +
 * guardian notifications rendered OFF the request on the F3 job substrate —
 * amend by supersession, and gate visibility with audited FinancialHolds. Reuses
 * F4 documents/signatures, F5 delivery, WB1-4 guardianship audience, and the
 * WB1-6 maker-checker + scope.
 *
 * Completed by WB4-2/3/4: scores also arrive from a **spreadsheet** through the
 * same entry writer (dry-run first, absent ≠ zero preserved), a cycle carries an
 * **affective/psychomotor rubric** that is snapshotted onto the report card, and
 * a student's **cumulative transcript** is assembled from published snapshots
 * alone.
 */
@Module({
  imports: [
    CommonModule,
    AuthModule,
    DocumentsModule,
    CommunicationModule,
    JobsModule,
    PersonModule,
  ],
  controllers: [
    ResultCycleController,
    ResultEntryController,
    ResultPublicationController,
    ResultTraitController,
    ResultTranscriptController,
    FinancialHoldController,
  ],
  providers: [
    ResultCycleService,
    ResultEntryService,
    ResultPublicationService,
    ResultTraitService,
    ResultImportService,
    ResultTranscriptService,
    ResultArtifactService,
    FinancialHoldService,
    ResultsJobRegistrar,
  ],
  exports: [ResultCycleService, ResultPublicationService, FinancialHoldService],
})
export class ResultsModule {}
