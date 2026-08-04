/**
 * First-class staff employment (WB1-2) — behavioural proof on the app_runtime
 * (RLS-enforcing) client.
 *
 * Acceptance:
 *   - create / disable an employment INDEPENDENT of any payroll run
 *   - the People directory Staff view reads Employment (StaffProfile), not payroll
 *   - reporting line is validated (no self, no cycle); qualifications add/remove
 *   - the (tenant, source_system, source_id) key makes the payroll back-fill
 *     idempotent (a duplicate sourced row is rejected)
 *   - RLS isolates employment across tenants; the HTTP guard stack rejects
 *     unauthenticated calls
 *
 * Requires APP_RUNTIME_DATABASE_URL (the restricted role). Skips otherwise —
 * without it RLS is bypassed and the isolation assertions are meaningless.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { randomUUID } from 'node:crypto';

import { AppModule } from '../src/app.module';
import { TenantDbService } from '../src/common';
import { StaffEmploymentService } from '../src/employment/services/staff-employment.service';
import { PeopleDirectoryService } from '../src/directory/services/people-directory.service';
import { makeSuperuserClient } from './helpers/superuser-client';

const HAS_APP_RUNTIME = !!process.env.APP_RUNTIME_DATABASE_URL;
const d = HAS_APP_RUNTIME ? describe : describe.skip;

interface CountRow {
  n: number;
}

d('Staff employment (WB1-2)', () => {
  let app: INestApplication;
  let owner: ReturnType<typeof makeSuperuserClient>;
  let tenantDb: TenantDbService;
  let employment: StaffEmploymentService;
  let peopleDirectory: PeopleDirectoryService;

  const stamp = Date.now();
  const A = `emp-a-${stamp}`;
  const B = `emp-b-${stamp}`;

  let tenantAId: string;
  let tenantBId: string;
  let actorId: string;
  let personId: string; // the staff person
  let managerPersonId: string;

  // shared across ordered tests
  let employmentId: string;
  let managerEmploymentId: string;

  const inA = <T>(fn: () => Promise<T>) =>
    tenantDb.runScoped(tenantAId, actorId, fn);
  const inB = <T>(fn: () => Promise<T>) =>
    tenantDb.runScoped(tenantBId, actorId, fn);

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();

    owner = makeSuperuserClient();
    tenantDb = app.get(TenantDbService);
    employment = app.get(StaffEmploymentService);
    peopleDirectory = app.get(PeopleDirectoryService);

    const [ta, tb] = await Promise.all([
      owner.tenant.create({
        data: { name: 'Emp A', slug: A, status: 'active' },
      }),
      owner.tenant.create({
        data: { name: 'Emp B', slug: B, status: 'active' },
      }),
    ]);
    tenantAId = ta.id;
    tenantBId = tb.id;

    const actor = await owner.user.create({
      data: { email: `emp-actor-${stamp}@a.test`, isActive: true },
    });
    actorId = actor.id;

    const [staff, manager] = await Promise.all([
      owner.person.create({
        data: {
          tenantId: tenantAId,
          firstName: 'Bola',
          lastName: 'Bursar',
          status: 'active',
        },
      }),
      owner.person.create({
        data: {
          tenantId: tenantAId,
          firstName: 'Hakeem',
          lastName: 'Head',
          status: 'active',
        },
      }),
    ]);
    personId = staff.id;
    managerPersonId = manager.id;
  });

  afterAll(async () => {
    if (owner) {
      await owner.tenant.deleteMany({ where: { slug: { in: [A, B] } } });
      await owner.user.deleteMany({
        where: { email: `emp-actor-${stamp}@a.test` },
      });
      await owner.$disconnect();
    }
    if (app) await app.close();
  });

  it('opens an employment with no payroll run in sight', async () => {
    // A manager employment first, so we can wire a reporting line.
    const mgr = await inA(() =>
      employment.create(tenantAId, actorId, managerPersonId, {
        jobTitle: 'Head of School',
        department: 'Leadership',
        employmentType: 'full_time',
      }),
    );
    managerEmploymentId = mgr.id;

    const created = await inA(() =>
      employment.create(tenantAId, actorId, personId, {
        jobTitle: 'Bursar',
        department: 'Finance',
        employmentType: 'full_time',
        employeeNumber: `E-${stamp}`,
        hireDate: '2026-01-15',
        reportsToStaffProfileId: managerEmploymentId,
      }),
    );
    employmentId = created.id;

    expect(created.employmentStatus).toBe('active');
    expect(created.jobTitle).toBe('Bursar');
    expect(created.reportsTo?.id).toBe(managerEmploymentId);

    // No payroll record exists for this person — employment stands alone.
    const payroll = await owner.staffPayrollRecord.count({
      where: { tenantId: tenantAId },
    });
    expect(payroll).toBe(0);
  });

  it('the People directory Staff view reads Employment (not payroll)', async () => {
    const list = await inA(() =>
      peopleDirectory.list(tenantAId, 'staff', true, {}),
    );
    const row = list.data.find((r) => r.id === personId);
    expect(row).toBeDefined();
    // primary = jobTitle for the staff tab; status = employmentStatus.
    expect(row!.primary).toBe('Bursar');
    expect(row!.status).toBe('active');
    expect(row!.profiles).toContain('staff');
  });

  it('rejects a self / cyclic reporting line', async () => {
    await expect(
      inA(() =>
        employment.update(tenantAId, actorId, employmentId, {
          reportsToStaffProfileId: employmentId,
        }),
      ),
    ).rejects.toThrow(/itself/i);

    // manager → bursar would close a cycle (bursar already reports to manager).
    await expect(
      inA(() =>
        employment.update(tenantAId, actorId, managerEmploymentId, {
          reportsToStaffProfileId: employmentId,
        }),
      ),
    ).rejects.toThrow(/cycle/i);
  });

  it('adds and removes qualifications', async () => {
    const q = await inA(() =>
      employment.addQualification(tenantAId, actorId, employmentId, {
        title: 'B.Sc Accounting',
        qualificationType: 'degree',
        institution: 'University of Lagos',
        awardedYear: 2015,
      }),
    );
    let detail = await inA(() => employment.listForPerson(tenantAId, personId));
    expect(detail.data[0]!.qualifications.map((x) => x.title)).toContain(
      'B.Sc Accounting',
    );

    await inA(() => employment.removeQualification(tenantAId, actorId, q.id));
    detail = await inA(() => employment.listForPerson(tenantAId, personId));
    expect(detail.data[0]!.qualifications).toHaveLength(0);
  });

  it('disables (ends) the employment independent of payroll', async () => {
    const disabled = await inA(() =>
      employment.disable(tenantAId, actorId, employmentId, {
        reason: 'Resigned',
      }),
    );
    expect(disabled.employmentStatus).toBe('terminated');
    expect(disabled.endDate).toBeTruthy();
    expect(disabled.endReason).toBe('Resigned');

    // Disabling twice is refused.
    await expect(
      inA(() => employment.disable(tenantAId, actorId, employmentId, {})),
    ).rejects.toThrow(/already ended/i);
  });

  it('the (tenant, source_system, source_id) key makes the back-fill idempotent', async () => {
    // Two sourced rows with the same key collide — this is what stops the
    // payroll back-fill from ever creating a duplicate stint on re-run.
    await owner.staffProfile.create({
      data: {
        id: randomUUID(),
        tenantId: tenantAId,
        personId: managerPersonId,
        sourceSystem: 'payroll',
        sourceId: `dup-${stamp}`,
      },
    });
    await expect(
      owner.staffProfile.create({
        data: {
          id: randomUUID(),
          tenantId: tenantAId,
          personId: managerPersonId,
          sourceSystem: 'payroll',
          sourceId: `dup-${stamp}`,
        },
      }),
    ).rejects.toThrow(); // unique violation on staff_profiles_source_key
  });

  it('RLS isolates employment across tenants', async () => {
    const crossTenant = await inB(() =>
      employment.listForPerson(tenantAId, personId).catch(() => null),
    );
    // Under B's scope the person is invisible → NotFound (null) or empty.
    expect(crossTenant === null || crossTenant.data.length === 0).toBe(true);

    const rows = await inB(
      () =>
        tenantDb.client.$queryRaw<CountRow[]>`
          SELECT COUNT(*)::int AS n
          FROM "person"."staff_profiles"
          WHERE "person_id" = ${personId}
        `,
    );
    expect(rows[0]!.n).toBe(0);
  });

  it('rejects unauthenticated employment calls at the boundary', async () => {
    const http = app.getHttpServer();
    await request(http)
      .get(`/directory/people/${personId}/employment`)
      .expect(401);
    await request(http)
      .post(`/directory/people/${personId}/employment`)
      .send({ jobTitle: 'x' })
      .expect(401);
  });
});
