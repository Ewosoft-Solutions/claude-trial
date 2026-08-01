import { Module } from '@nestjs/common';
import { CommonModule } from '../common';
import { StorageModule } from '../common/storage/storage.module';
import { JobsModule } from '../common/jobs/jobs.module';
import { AuthModule } from '../auth/auth.module';
import { TenantModule } from '../tenant/tenant.module';
import { DocumentsController } from './controllers/documents.controller';
import { DocumentService } from './services/document.service';
import { SignatureService } from './services/signature.service';
import { DocumentUrlSigner } from './storage/document-url-signer';
import {
  DOCUMENT_SCANNER,
  HeuristicDocumentScanner,
} from './storage/document-scanner';
import { DocumentJobRegistrar } from './jobs/document-job.registrar';

/**
 * Document/attachment + signature platform (F4 / ADR-08). Logical Document vs
 * stored DocumentVersion behind the StorageProvider port; scan/thumbnail run on
 * F3 jobs; downloads via signed short-lived URLs; signatures are governed assets.
 */
@Module({
  imports: [CommonModule, StorageModule, JobsModule, AuthModule, TenantModule],
  controllers: [DocumentsController],
  providers: [
    DocumentService,
    SignatureService,
    DocumentUrlSigner,
    DocumentJobRegistrar,
    HeuristicDocumentScanner,
    { provide: DOCUMENT_SCANNER, useExisting: HeuristicDocumentScanner },
  ],
  exports: [DocumentService, SignatureService],
})
export class DocumentsModule {}
