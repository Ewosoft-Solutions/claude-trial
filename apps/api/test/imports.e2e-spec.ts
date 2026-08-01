/**
 * Import & migration platform (F2 / ADR-09) — behavioural proof.
 *
 * Boots the real AppModule and exercises ImportService on the app_runtime
 * (RLS-enforcing) client, committing into Person (F1). Proves the ADR-09
 * acceptance:
 *   - a CSV with invalid rows → valid rows are NOT silently committed around the
 *     bad ones; invalid rows sit in an explicit exception queue
 *   - a re-run with the same source IDs is idempotent (no duplicate Persons)
 *   - reconciliation totals pass exactly
 *   - a committed wave can be rolled back on the controlled path
 *   - RLS isolates import jobs across tenants
 *
 * Requires APP_RUNTIME_DATABASE_URL; skips otherwise (see jobs/person specs).
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { AppModule } from '../src/app.module';
import { TenantDbService } from '../src/common';
import { ImportService } from '../src/imports/services/import.service';
import { makeSuperuserClient } from './helpers/superuser-client';

const HAS_APP_RUNTIME = !!process.env.APP_RUNTIME_DATABASE_URL;
const d = HAS_APP_RUNTIME ? describe : describe.skip;

interface CountRow {
  n: number;
}

// externalId, First Name, Last Name, DOB. Row 2 has no last name, row 3 has no
// externalId — both must be rejected, leaving 2 valid rows.
const CSV = [
  'externalId,First Name,Last Name,DOB',
  'S001,Ada,Okafor,05/03/2012',
  'S002,Bola,,10/10/2011',
  ',Chidi,Eze,01/01/2010',
  'S004,Ngozi,Umeh,15/06/2013',
].join('\n');

const MAPPINGS = [
  { sourceColumn: 'externalId', targetField: 'sourceId', required: true },
  { sourceColumn: 'First Name', targetField: 'firstName', required: true },
  { sourceColumn: 'Last Name', targetField: 'lastName', required: true },
  {
    sourceColumn: 'DOB',
    targetField: 'dateOfBirth',
    transform: { type: 'date_parse', config: { format: 'DD/MM/YYYY' } },
  },
];

d('Import & migration platform (F2)', () => {
  let app: INestApplication;
  let owner: ReturnType<typeof makeSuperuserClient>;
  let tenantDb: TenantDbService;
  let imports: ImportService;

  const A = `imp-a-${Date.now()}`;
  const B = `imp-b-${Date.now()}`;
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
    imports = app.get(ImportService);

    const ta = await owner.tenant.create({
      data: { name: 'Imp A', slug: A, status: 'active' },
    });
    const tb = await owner.tenant.create({
      data: { name: 'Imp B', slug: B, status: 'active' },
    });
    tenantAId = ta.id;
    tenantBId = tb.id;

    await tenantDb.runScoped(tenantAId, undefined, () =>
      imports.createDefinition(tenantAId, undefined, {
        key: 'people-v1',
        name: 'People',
        targetDomain: 'people',
        reconciliationRules: [{ name: 'row-count', kind: 'count' }],
      }),
    );
  });

  afterAll(async () => {
    if (owner) {
      await owner.tenant.deleteMany({ where: { slug: { in: [A, B] } } });
      await owner.$disconnect();
    }
    if (app) await app.close();
  });

  const inA = <T>(fn: () => Promise<T>) =>
    tenantDb.runScoped(tenantAId, undefined, fn);
  const inB = <T>(fn: () => Promise<T>) =>
    tenantDb.runScoped(tenantBId, undefined, fn);

  const b64 = (s: string) => Buffer.from(s, 'utf8');

  const personCount = async (sourceSystem: string) => {
    const rows = await owner.$queryRaw<CountRow[]>`
      SELECT count(*)::int AS n FROM "person"."persons"
      WHERE "tenant_id" = ${tenantAId} AND "source_system" = ${sourceSystem}`;
    return rows[0].n;
  };

  const runPipeline = async (sourceSystem: string) => {
    return inA(async () => {
      const job = await imports.createJob(
        tenantAId,
        undefined,
        'people-v1',
        sourceSystem,
      );
      await imports.attachSourceFile(tenantAId, undefined, job.id, {
        filename: 'people.csv',
        mime: 'text/csv',
        content: b64(CSV),
      });
      await imports.setMapping(tenantAId, undefined, job.id, MAPPINGS);
      const v = await imports.validate(tenantAId, undefined, job.id);
      return { jobId: job.id, validation: v };
    });
  };

  it('rejects invalid rows to an exception queue; valid rows are not committed around them', async () => {
    const source = 'legacy-accept';
    const { jobId, validation } = await runPipeline(source);
    expect(validation.valid).toBe(2);
    expect(validation.invalid).toBe(2);

    const commit = await inA(() => imports.commit(tenantAId, undefined, jobId));
    expect(commit.created).toBe(2);
    expect(commit.updated).toBe(0);
    expect(commit.skipped).toBe(2);

    // exactly the 2 valid rows created Persons; the 2 bad rows created none
    expect(await personCount(source)).toBe(2);

    const exceptions = await inA(() => imports.listExceptions(tenantAId, jobId));
    expect(exceptions).toHaveLength(2);
    expect(exceptions.every((r) => r.issues.length > 0)).toBe(true);

    // reconciliation: committed count equals valid count, exactly
    const recon = await inA(() => imports.reconcile(tenantAId, undefined, jobId));
    expect(recon.allPassed).toBe(true);
  });

  it('is idempotent: a re-run with the same source IDs creates no duplicates', async () => {
    const source = 'legacy-idem';
    const first = await runPipeline(source);
    const c1 = await inA(() => imports.commit(tenantAId, undefined, first.jobId));
    expect(c1.created).toBe(2);
    expect(await personCount(source)).toBe(2);

    // A fresh job, same source system + same external IDs → upsert, not insert.
    const second = await runPipeline(source);
    const c2 = await inA(() => imports.commit(tenantAId, undefined, second.jobId));
    expect(c2.created).toBe(0);
    expect(c2.updated).toBe(2);
    expect(await personCount(source)).toBe(2); // still 2 — no duplicates
  });

  it('rolls back a committed wave on the controlled path', async () => {
    const source = 'legacy-rb';
    const { jobId } = await runPipeline(source);
    await inA(() => imports.commit(tenantAId, undefined, jobId));
    expect(await personCount(source)).toBe(2);

    const rb = await inA(() => imports.rollback(tenantAId, undefined, jobId));
    expect(rb.removed).toBe(2);
    expect(await personCount(source)).toBe(0);

    const detail = await inA(() => imports.getJobDetail(tenantAId, jobId));
    expect(detail.status).toBe('rolled_back');
  });

  it('isolates import jobs by tenant (RLS)', async () => {
    const { jobId } = await runPipeline('legacy-iso');
    await expect(inB(() => imports.getJobDetail(tenantBId, jobId))).rejects.toThrow();

    const seenFromB = await inB(async () => {
      const rows = await tenantDb.client.$queryRaw<CountRow[]>`
        SELECT count(*)::int AS n FROM "imports"."import_jobs" WHERE "id" = ${jobId}`;
      return rows[0].n;
    });
    expect(seenFromB).toBe(0);
  });
});
