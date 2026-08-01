import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { TenantDbService } from '../database/tenant-db.service';
import { JobHandlerRegistry } from './job-handler.registry';
import type { JobContext, JobRow } from './job.types';

/**
 * Durable job worker.
 *
 * Polls `jobs.jobs`, claims one ready job at a time under the audited
 * `app.is_platform` scope (the sanctioned cross-tenant path — never the
 * privileged RLS-bypass client), then runs its handler under the job's own
 * tenant scope. The handler's side effects and the job's `succeeded` update
 * commit in ONE transaction, so a crash before commit rolls both back and the
 * job re-runs cleanly — exactly-once for database side effects. Failures retry
 * with backoff up to `max_attempts`, then land in a terminal `dead` state.
 * Jobs stuck `running` past the stale-lock window are reclaimed (crash recovery).
 */
@Injectable()
export class JobWorker implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(JobWorker.name);
  private readonly workerId = `worker-${randomUUID().slice(0, 8)}`;
  private readonly pollIntervalMs = 1_000;
  private readonly staleLockMs = 60_000;
  private readonly batchSize = 10;
  private timer: NodeJS.Timeout | null = null;
  private ticking = false;
  private stopped = false;

  constructor(
    private readonly tenantDb: TenantDbService,
    private readonly registry: JobHandlerRegistry,
  ) {}

  onApplicationBootstrap(): void {
    // Off in tests (they drive processOnce() deterministically) and when
    // explicitly disabled (e.g. a web-only dyno). On elsewhere.
    const nodeEnv = process.env.NODE_ENV;
    const disabled =
      process.env.JOBS_WORKER_ENABLED === 'false' || nodeEnv === 'test';
    if (disabled) {
      this.logger.log(`Job worker not auto-started (NODE_ENV=${nodeEnv}).`);
      return;
    }
    this.start();
  }

  async onModuleDestroy(): Promise<void> {
    this.stop();
  }

  start(): void {
    if (this.timer) return;
    this.stopped = false;
    this.timer = setInterval(() => void this.tick(), this.pollIntervalMs);
    this.logger.log(
      `Job worker ${this.workerId} started (poll ${this.pollIntervalMs}ms).`,
    );
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** One poll cycle: reclaim stale locks, then drain up to a batch of ready jobs. */
  async tick(): Promise<void> {
    if (this.ticking) return;
    this.ticking = true;
    try {
      await this.reclaimStale();
      for (let i = 0; i < this.batchSize; i++) {
        if (this.stopped) break;
        const processed = await this.processOnce();
        if (!processed) break;
      }
    } catch (err) {
      this.logger.error(`tick failed: ${errorMessage(err)}`);
    } finally {
      this.ticking = false;
    }
  }

  /** Claim and run a single ready job. Returns false when none are ready. */
  async processOnce(): Promise<boolean> {
    const job = await this.claim();
    if (!job) return false;

    const handler = this.registry.get(job.type);
    if (!handler) {
      await this.fail(job, `no handler registered for type=${job.type}`);
      return true;
    }

    try {
      const run = <T>(fn: () => Promise<T>): Promise<T> =>
        job.tenant_id
          ? this.tenantDb.runScoped(job.tenant_id, job.actor_id ?? undefined, fn)
          : this.tenantDb.runPlatform(job.actor_id ?? undefined, fn);

      await run(async () => {
        const client = this.tenantDb.client;
        const ctx: JobContext = {
          job,
          tenantId: job.tenant_id,
          client,
          setProgress: async (percent) => {
            await client.$executeRaw`
              UPDATE "jobs"."jobs"
              SET "progress" = ${clampPercent(percent)}, "updated_at" = now()
              WHERE "id" = ${job.id}`;
          },
        };
        // Side effects + completion in ONE transaction → exactly-once on commit.
        await handler(job.payload, ctx);
        await client.$executeRaw`
          UPDATE "jobs"."jobs"
          SET "status" = 'succeeded', "progress" = 100, "finished_at" = now(),
              "locked_at" = NULL, "locked_by" = NULL, "error" = NULL,
              "updated_at" = now()
          WHERE "id" = ${job.id}`;
      });
      return true;
    } catch (err) {
      await this.fail(job, errorMessage(err));
      return true;
    }
  }

  /** Atomically claim the oldest ready job across all tenants (audited platform scope). */
  private async claim(): Promise<JobRow | null> {
    return this.tenantDb.runPlatform(undefined, async () => {
      const rows = await this.tenantDb.client.$queryRaw<JobRow[]>`
        UPDATE "jobs"."jobs" AS j
        SET "status" = 'running', "attempts" = j."attempts" + 1, "locked_at" = now(),
            "locked_by" = ${this.workerId},
            "started_at" = COALESCE(j."started_at", now()), "updated_at" = now()
        WHERE j."id" = (
          SELECT "id" FROM "jobs"."jobs"
          WHERE "status" = 'queued' AND "run_after" <= now()
          ORDER BY "run_after" ASC
          FOR UPDATE SKIP LOCKED
          LIMIT 1
        )
        RETURNING j.*
      `;
      return rows[0] ?? null;
    });
  }

  /** Requeue with exponential backoff, or mark dead once attempts exhaust maxAttempts. */
  private async fail(job: JobRow, message: string): Promise<void> {
    const dead = job.attempts >= job.max_attempts;
    const backoffSec = Math.min(300, 2 ** job.attempts);
    await this.tenantDb.runPlatform(undefined, async () => {
      await this.tenantDb.client.$executeRaw`
        UPDATE "jobs"."jobs"
        SET "status" = ${dead ? 'dead' : 'queued'},
            "error" = ${message},
            "run_after" = now() + make_interval(secs => ${backoffSec}),
            "finished_at" = ${dead ? new Date() : null},
            "locked_at" = NULL, "locked_by" = NULL, "updated_at" = now()
        WHERE "id" = ${job.id}`;
    });
    if (dead) {
      this.logger.error(
        `job ${job.id} type=${job.type} dead after ${job.attempts} attempt(s): ${message}`,
      );
    }
  }

  /** Return jobs stuck `running` past the stale-lock window to the queue (crash recovery). */
  async reclaimStale(): Promise<number> {
    return this.tenantDb.runPlatform(undefined, async () => {
      const rows = await this.tenantDb.client.$queryRaw<{ id: string }[]>`
        UPDATE "jobs"."jobs"
        SET "status" = 'queued', "locked_at" = NULL, "locked_by" = NULL,
            "updated_at" = now()
        WHERE "status" = 'running'
          AND "locked_at" < now() - make_interval(secs => ${Math.ceil(this.staleLockMs / 1000)})
        RETURNING "id"`;
      return rows.length;
    });
  }
}

function clampPercent(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
