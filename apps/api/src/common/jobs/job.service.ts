import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { TenantDbService } from '../database/tenant-db.service';
import type { EnqueueJobInput, EnqueueResult, JobRow } from './job.types';

/**
 * Produces durable jobs. Enqueue runs **inside the caller's RLS-scoped
 * transaction** so the job and the domain change it accompanies commit or roll
 * back together (transactional-outbox principle). The JobWorker consumes them.
 */
@Injectable()
export class JobService {
  constructor(private readonly tenantDb: TenantDbService) {}

  /**
   * Enqueue a job within the caller's transaction (throws if used outside a
   * runScoped/runPlatform scope — that guard prevents a job being written on an
   * unscoped connection where RLS would blank it).
   *
   * Idempotent: a re-enqueue with the same (tenantId, idempotencyKey) is a no-op
   * returning the existing job id (deduped=true). Uses ON CONFLICT DO NOTHING so
   * a duplicate never aborts the caller's transaction.
   */
  async enqueue(input: EnqueueJobInput): Promise<EnqueueResult> {
    const client = this.tenantDb.client;
    const id = randomUUID();
    const tenantId = input.tenantId ?? null;
    const idempotencyKey = input.idempotencyKey ?? null;
    const payloadJson =
      input.payload == null ? null : JSON.stringify(input.payload);

    const inserted = await client.$queryRaw<{ id: string }[]>`
      INSERT INTO "jobs"."jobs"
        ("id","tenant_id","type","status","idempotency_key","payload","actor_id",
         "max_attempts","run_after","created_at","updated_at")
      VALUES
        (${id}, ${tenantId}, ${input.type}, 'queued', ${idempotencyKey},
         ${payloadJson}::jsonb, ${input.actorId ?? null},
         ${input.maxAttempts ?? 5}, COALESCE(${input.runAfter ?? null}, now()), now(), now())
      ON CONFLICT ("tenant_id","idempotency_key") DO NOTHING
      RETURNING "id"
    `;

    if (inserted.length > 0) {
      return { jobId: inserted[0].id, deduped: false };
    }

    // Conflict: an existing job already carries this (tenant, key). Return it.
    const existing = await client.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "jobs"."jobs"
      WHERE "tenant_id" IS NOT DISTINCT FROM ${tenantId}
        AND "idempotency_key" = ${idempotencyKey}
      LIMIT 1
    `;
    return { jobId: existing[0]?.id ?? id, deduped: true };
  }

  /** Fetch a job by id within the current RLS scope (null if not visible/absent). */
  async find(id: string): Promise<JobRow | null> {
    const rows = await this.tenantDb.client.$queryRaw<JobRow[]>`
      SELECT * FROM "jobs"."jobs" WHERE "id" = ${id} LIMIT 1
    `;
    return rows[0] ?? null;
  }
}
