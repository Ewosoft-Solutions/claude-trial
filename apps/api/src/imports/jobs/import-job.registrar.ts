import { Injectable, OnModuleInit } from '@nestjs/common';
import { JobHandlerRegistry } from '../../common/jobs/job-handler.registry';
import type { JobContext } from '../../common/jobs/job.types';
import { ImportService } from '../services/import.service';
import {
  IMPORT_COMMIT_JOB,
  IMPORT_RECONCILE_JOB,
  ImportJobPayload,
} from '../imports.constants';

/**
 * Runs the heavy import steps (commit, reconcile) on the durable F3 substrate
 * (ADR-09 "runs on ADR-06 jobs"). Each handler executes in the job's own tenant
 * scope, so the ImportService writes are RLS-correct and exactly-once.
 */
@Injectable()
export class ImportJobRegistrar implements OnModuleInit {
  constructor(
    private readonly registry: JobHandlerRegistry,
    private readonly imports: ImportService,
  ) {}

  onModuleInit(): void {
    this.registry.register<ImportJobPayload>(IMPORT_COMMIT_JOB, (p, ctx) =>
      this.commit(p, ctx),
    );
    this.registry.register<ImportJobPayload>(IMPORT_RECONCILE_JOB, (p, ctx) =>
      this.reconcile(p, ctx),
    );
  }

  private async commit(p: ImportJobPayload, ctx: JobContext): Promise<void> {
    await this.imports.commit(
      ctx.tenantId as string,
      p.actorId ?? undefined,
      p.importJobId,
    );
  }

  private async reconcile(p: ImportJobPayload, ctx: JobContext): Promise<void> {
    await this.imports.reconcile(
      ctx.tenantId as string,
      p.actorId ?? undefined,
      p.importJobId,
    );
  }
}
