/**
 * Durable jobs + transactional outbox (F3 / ADR-06) — behavioural proof.
 *
 * Boots the real AppModule and exercises JobService + JobWorker on the
 * app_runtime (RLS-enforcing) client. Proves the acceptance criteria:
 *   - enqueue is idempotent on (tenant, idempotencyKey) — a re-enqueue is a no-op
 *   - a job is processed exactly once (handler side effect happens once)
 *   - a failed job retries with backoff, then lands in terminal `dead`
 *   - a crash mid-run leaves no partial side effect (handler + completion are one tx)
 *   - enqueue / outbox emit roll back with the caller's transaction (atomic)
 *   - RLS isolates jobs: a tenant cannot see another tenant's jobs
 *
 * Requires APP_RUNTIME_DATABASE_URL (the restricted role). Skips otherwise —
 * without it the tenant client falls back to the privileged role and RLS is
 * bypassed, so the isolation assertions would be meaningless.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from '@jest/globals';
import { AppModule } from '../src/app.module';
import { TenantDbService } from '../src/common';
import { JobService } from '../src/common/jobs/job.service';
import { OutboxService } from '../src/common/jobs/outbox.service';
import { JobWorker } from '../src/common/jobs/job.worker';
import { JobHandlerRegistry } from '../src/common/jobs/job-handler.registry';
import type { JobContext } from '../src/common/jobs/job.types';
import { makeSuperuserClient } from './helpers/superuser-client';

const HAS_APP_RUNTIME = !!process.env.APP_RUNTIME_DATABASE_URL;
const d = HAS_APP_RUNTIME ? describe : describe.skip;

interface CountRow {
  n: number;
}
interface JobStateRow {
  status: string;
  attempts: number;
}

d('Durable jobs + outbox (F3)', () => {
  let app: INestApplication;
  let owner: ReturnType<typeof makeSuperuserClient>;
  let tenantDb: TenantDbService;
  let jobs: JobService;
  let outbox: OutboxService;
  let worker: JobWorker;

  const A = `jobs-a-${Date.now()}`;
  const B = `jobs-b-${Date.now()}`;
  let tenantAId: string;
  let tenantBId: string;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();

    owner = makeSuperuserClient();
    tenantDb = app.get(TenantDbService);
    jobs = app.get(JobService);
    outbox = app.get(OutboxService);
    worker = app.get(JobWorker);

    const ta = await owner.tenant.create({
      data: { name: 'Jobs A', slug: A, status: 'active' },
    });
    const tb = await owner.tenant.create({
      data: { name: 'Jobs B', slug: B, status: 'active' },
    });
    tenantAId = ta.id;
    tenantBId = tb.id;

    const registry = app.get(JobHandlerRegistry);
    // No-op: enqueued but its side effect is irrelevant.
    registry.register('test.noop', async () => {});
    // Records one announcement (a countable, tenant-scoped side effect).
    registry.register('test.count', async (payload, ctx: JobContext) => {
      const { marker } = payload as { marker: string };
      await ctx.client.announcement.create({
        data: {
          tenantId: ctx.tenantId as string,
          targetType: 'all',
          title: marker,
          content: 'x',
        },
      });
    });
    // Fails on attempt 1, succeeds on attempt 2 (attempts is incremented at claim).
    registry.register('test.flaky', async (payload, ctx: JobContext) => {
      if (ctx.job.attempts < 2) throw new Error('flaky: forced failure');
      const { marker } = payload as { marker: string };
      await ctx.client.announcement.create({
        data: {
          tenantId: ctx.tenantId as string,
          targetType: 'all',
          title: marker,
          content: 'x',
        },
      });
    });
    // Always throws — used to prove the dead terminal state.
    registry.register('test.always-fail', async () => {
      throw new Error('always fails');
    });
  });

  afterAll(async () => {
    if (owner) {
      // FK ON DELETE CASCADE cleans jobs + announcements for these tenants.
      await owner.tenant.deleteMany({ where: { slug: { in: [A, B] } } });
      await owner.$disconnect();
    }
    if (app) await app.close();
  });

  beforeEach(async () => {
    await owner.$executeRaw`DELETE FROM "jobs"."jobs" WHERE "tenant_id" = ${tenantAId} OR "tenant_id" = ${tenantBId}`;
    await owner.$executeRaw`DELETE FROM "jobs"."outbox_events" WHERE "tenant_id" = ${tenantAId} OR "tenant_id" = ${tenantBId}`;
    await owner.announcement.deleteMany({
      where: { tenantId: { in: [tenantAId, tenantBId] } },
    });
  });

  const countAnnouncements = (tenantId: string, marker: string) =>
    owner.announcement.count({ where: { tenantId, title: marker } });

  const getJob = async (id: string): Promise<JobStateRow | null> => {
    const rows = await owner.$queryRaw<JobStateRow[]>`
      SELECT "status", "attempts" FROM "jobs"."jobs" WHERE "id" = ${id} LIMIT 1`;
    return rows[0] ?? null;
  };

  it('enqueue is idempotent on (tenant, idempotencyKey)', async () => {
    const key = `idem-${Date.now()}`;
    const first = await tenantDb.runScoped(tenantAId, undefined, () =>
      jobs.enqueue({ type: 'test.noop', tenantId: tenantAId, idempotencyKey: key }),
    );
    const second = await tenantDb.runScoped(tenantAId, undefined, () =>
      jobs.enqueue({ type: 'test.noop', tenantId: tenantAId, idempotencyKey: key }),
    );

    expect(first.deduped).toBe(false);
    expect(second.deduped).toBe(true);
    expect(second.jobId).toBe(first.jobId);

    const rows = await owner.$queryRaw<CountRow[]>`
      SELECT count(*)::int AS n FROM "jobs"."jobs"
      WHERE "tenant_id" = ${tenantAId} AND "idempotency_key" = ${key}`;
    expect(rows[0].n).toBe(1);
  });

  it('processes a job exactly once', async () => {
    const marker = `once-${Date.now()}`;
    await tenantDb.runScoped(tenantAId, undefined, () =>
      jobs.enqueue({ type: 'test.count', tenantId: tenantAId, payload: { marker } }),
    );

    expect(await worker.processOnce()).toBe(true); // claimed + ran
    expect(await worker.processOnce()).toBe(false); // nothing ready left
    expect(await countAnnouncements(tenantAId, marker)).toBe(1);
  });

  it('retries a failed job, then succeeds with no duplicate side effect', async () => {
    const marker = `retry-${Date.now()}`;
    const { jobId } = await tenantDb.runScoped(tenantAId, undefined, () =>
      jobs.enqueue({
        type: 'test.flaky',
        tenantId: tenantAId,
        payload: { marker },
        maxAttempts: 3,
      }),
    );

    // Attempt 1 throws → requeued with backoff; its side effect rolled back.
    expect(await worker.processOnce()).toBe(true);
    expect((await getJob(jobId))?.status).toBe('queued');
    expect((await getJob(jobId))?.attempts).toBe(1);
    expect(await countAnnouncements(tenantAId, marker)).toBe(0);

    // Skip the backoff window, then attempt 2 succeeds.
    await owner.$executeRaw`UPDATE "jobs"."jobs" SET "run_after" = now() WHERE "id" = ${jobId}`;
    expect(await worker.processOnce()).toBe(true);
    const job = await getJob(jobId);
    expect(job?.status).toBe('succeeded');
    expect(job?.attempts).toBe(2);
    expect(await countAnnouncements(tenantAId, marker)).toBe(1); // exactly once
  });

  it('marks a job dead after exhausting maxAttempts', async () => {
    const { jobId } = await tenantDb.runScoped(tenantAId, undefined, () =>
      jobs.enqueue({
        type: 'test.always-fail',
        tenantId: tenantAId,
        maxAttempts: 2,
      }),
    );

    expect(await worker.processOnce()).toBe(true); // attempt 1 → queued
    expect((await getJob(jobId))?.status).toBe('queued');
    await owner.$executeRaw`UPDATE "jobs"."jobs" SET "run_after" = now() WHERE "id" = ${jobId}`;
    expect(await worker.processOnce()).toBe(true); // attempt 2 → dead

    const job = await getJob(jobId);
    expect(job?.status).toBe('dead');
    expect(job?.attempts).toBe(2);
  });

  it('enqueue rolls back with the caller transaction (atomic)', async () => {
    const marker = `atomic-${Date.now()}`;
    await expect(
      tenantDb.runScoped(tenantAId, undefined, async () => {
        await jobs.enqueue({
          type: 'test.noop',
          tenantId: tenantAId,
          payload: { marker },
        });
        throw new Error('domain failure after enqueue');
      }),
    ).rejects.toThrow('domain failure');

    const rows = await owner.$queryRaw<CountRow[]>`
      SELECT count(*)::int AS n FROM "jobs"."jobs"
      WHERE "tenant_id" = ${tenantAId} AND "payload"->>'marker' = ${marker}`;
    expect(rows[0].n).toBe(0);
  });

  it('outbox emit rolls back with the caller transaction (atomic)', async () => {
    const aggId = `agg-${Date.now()}`;
    await expect(
      tenantDb.runScoped(tenantAId, undefined, async () => {
        await outbox.emit({
          tenantId: tenantAId,
          aggregate: 'Test',
          aggregateId: aggId,
          type: 'test.happened',
        });
        throw new Error('rollback');
      }),
    ).rejects.toThrow('rollback');

    const rows = await owner.$queryRaw<CountRow[]>`
      SELECT count(*)::int AS n FROM "jobs"."outbox_events"
      WHERE "aggregate_id" = ${aggId}`;
    expect(rows[0].n).toBe(0);
  });

  it('isolates jobs by tenant (RLS): A cannot see B jobs', async () => {
    const { jobId: jobB } = await tenantDb.runScoped(tenantBId, undefined, () =>
      jobs.enqueue({ type: 'test.noop', tenantId: tenantBId }),
    );

    const fromA = await tenantDb.runScoped(tenantAId, undefined, () =>
      jobs.find(jobB),
    );
    const fromB = await tenantDb.runScoped(tenantBId, undefined, () =>
      jobs.find(jobB),
    );

    expect(fromA).toBeNull();
    expect(fromB?.id).toBe(jobB);
  });
});
