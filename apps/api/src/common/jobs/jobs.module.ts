import { Module } from '@nestjs/common';
import { JobService } from './job.service';
import { OutboxService } from './outbox.service';
import { JobHandlerRegistry } from './job-handler.registry';
import { JobWorker } from './job.worker';

/**
 * Durable jobs + transactional outbox (F3 / ADR-06).
 *
 * Provides the substrate; TenantDbService (RLS-enforcing app_runtime client) and
 * ConfigService are global. Coexists with the legacy in-memory QueueService —
 * callers migrate to JobService/JobHandlerRegistry incrementally.
 */
@Module({
  providers: [JobService, OutboxService, JobHandlerRegistry, JobWorker],
  exports: [JobService, OutboxService, JobHandlerRegistry, JobWorker],
})
export class JobsModule {}
