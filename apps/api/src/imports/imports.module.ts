import { Module } from '@nestjs/common';
import { CommonModule } from '../common';
import { JobsModule } from '../common/jobs/jobs.module';
import { AuthModule } from '../auth/auth.module';
import { TenantModule } from '../tenant/tenant.module';
import { DocumentsModule } from '../documents/documents.module';
import { ImportsController } from './controllers/imports.controller';
import { ImportService } from './services/import.service';
import { ImportJobRegistrar } from './jobs/import-job.registrar';

/**
 * Import & migration platform (F2 / ADR-09). One idempotent, reconcilable
 * pipeline every bulk import reuses; commit target is Person (F1), source-file
 * storage is Document (F4), heavy steps run on F3 jobs.
 */
@Module({
  imports: [
    CommonModule,
    JobsModule,
    AuthModule,
    TenantModule,
    DocumentsModule,
  ],
  controllers: [ImportsController],
  providers: [ImportService, ImportJobRegistrar],
  exports: [ImportService],
})
export class ImportsModule {}
