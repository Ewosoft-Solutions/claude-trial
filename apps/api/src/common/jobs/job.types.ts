import type { Prisma } from '@workspace/database';

export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'dead';

/**
 * Row shape returned from raw queries against `jobs.jobs` (snake_case columns).
 * jsonb columns (`payload`, `row_counts`) come back already parsed.
 */
export interface JobRow {
  id: string;
  tenant_id: string | null;
  type: string;
  status: JobStatus;
  idempotency_key: string | null;
  payload: unknown;
  progress: number;
  row_counts: unknown;
  attempts: number;
  max_attempts: number;
  actor_id: string | null;
  result_artifact_id: string | null;
  error: string | null;
  run_after: Date;
  scheduled_at: Date | null;
  locked_at: Date | null;
  locked_by: string | null;
  started_at: Date | null;
  finished_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface EnqueueJobInput {
  /** Handler key, e.g. 'email.send'. A handler must be registered to process it. */
  type: string;
  /** null = platform/system job (no tenant). */
  tenantId?: string | null;
  payload?: unknown;
  /** Re-enqueue with the same (tenantId, idempotencyKey) is a no-op. */
  idempotencyKey?: string | null;
  actorId?: string | null;
  maxAttempts?: number;
  /** Earliest time the job may run (delayed jobs). Defaults to now. */
  runAfter?: Date;
}

export interface EnqueueResult {
  jobId: string;
  /** true when an existing job with the same (tenant, key) was returned instead of a new one. */
  deduped: boolean;
}

export interface JobContext {
  readonly job: JobRow;
  readonly tenantId: string | null;
  /**
   * RLS-scoped transaction client for the handler's domain writes. The handler's
   * side effects and the job's completion commit in this SAME transaction, so a
   * crash before commit rolls both back — the job re-runs cleanly (exactly-once).
   */
  readonly client: Prisma.TransactionClient;
  /** Report 0..100 progress. */
  setProgress(percent: number): Promise<void>;
}

export type JobHandler<P = unknown> = (
  payload: P,
  ctx: JobContext,
) => Promise<void>;
