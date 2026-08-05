/**
 * WB2-3 · Student lifecycle: registration · transfer · withdrawal · graduation —
 * behavioural proof on the app_runtime (RLS-enforcing) client.
 *
 * Acceptance (workbench-2 scenario 3 + WB2-3 card):
 *   - registration places a student into a section as their first active span.
 *   - a mid-year TRANSFER keeps BOTH placements with dates (the source span is
 *     closed, not deleted; a new span opens).
 *   - WITHDRAWAL / GRADUATION flip the lifecycle state and are auditable; prior
 *     placements are never destroyed.
 *   - `explainPlacement` returns the current placement + full history.
 *   - campus scope is enforced; RLS isolates tenants; HTTP 401 at the boundary.
 *
 * Requires APP_RUNTIME_DATABASE_URL; skips otherwise.
 */
import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  INestApplication,
} from '@nestjs/common';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { TenantDbService } from '../src/common';
import { StudentLifecycleService } from '../src/academic-structure/services/student-lifecycle.service';
import { makeSuperuserClient } from './helpers/superuser-client';

const HAS_APP_RUNTIME = !!process.env.APP_RUNTIME_DATABASE_URL;
const d = HAS_APP_RUNTIME ? describe : describe.skip;

d('Student lifecycle — register/transfer/withdraw/graduate (WB2-3)', () => {
  let app: INestApplication;
  let owner: ReturnType<typeof makeSuperuserClient>;
  let tenantDb: TenantDbService;
  let lifecycle: StudentLifecycleService;

  const stamp = Date.now();
  const A = `wb23-a-${stamp}`;
  const B = `wb23-b-${stamp}`;

  let tenantAId: string;
  let tenantBId: string;
  let campus1Id: string;
  let campus2Id: string;
  let yearId: string;
  let sectionA1Id: string; // campus1
  let sectionA2Id: string; // campus1 (transfer destination)
  let sectionC2Id: string; // campus2
  let studentId: string; // main lifecycle student
  let gradStudentId: string; // for graduation
  let scopeStudentId: string; // for campus-scope test
  let actorId: string;

  const inA = <T>(fn: () => Promise<T>) =>
    tenantDb.runScoped(tenantAId, actorId, fn);
  const inB = <T>(fn: () => Promise<T>) =>
    tenantDb.runScoped(tenantBId, actorId, fn);
  const unscoped = () => ({ userId: actorId, grantScope: null });

  async function makeStudent(tenantId: string, tag: string) {
    const user = await owner.user.create({
      data: { email: `wb23-${tag}-${stamp}@s.test`, isActive: true },
    });
    const ut = await owner.userTenant.create({
      data: { userId: user.id, tenantId, status: 'active' },
    });
    const student = await owner.student.create({
      data: {
        tenantId,
        userTenantId: ut.id,
        studentNumber: `STU-${tag}-${stamp}`,
      },
    });
    return student.id;
  }

  async function makeSection(
    tenantId: string,
    campusId: string,
    yearLevelId: string,
    name: string,
  ) {
    const s = await owner.classSection.create({
      data: {
        tenantId,
        campusId,
        yearLevelId,
        name,
        displayLabel: `SS1 ${name}`,
      },
    });
    return s.id;
  }

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();

    owner = makeSuperuserClient();
    tenantDb = app.get(TenantDbService);
    lifecycle = app.get(StudentLifecycleService);

    const [ta, tb, actor] = await Promise.all([
      owner.tenant.create({
        data: {
          name: 'WB23 A',
          slug: A,
          status: 'active',
          schoolType: 'secondary',
        },
      }),
      owner.tenant.create({
        data: {
          name: 'WB23 B',
          slug: B,
          status: 'active',
          schoolType: 'secondary',
        },
      }),
      owner.user.create({
        data: { email: `wb23-actor-${stamp}@a.test`, isActive: true },
      }),
    ]);
    tenantAId = ta.id;
    tenantBId = tb.id;
    actorId = actor.id;

    const [c1, c2] = await Promise.all([
      owner.campus.create({
        data: {
          tenantId: tenantAId,
          name: 'Main',
          code: 'MAIN',
          isPrimary: true,
        },
      }),
      owner.campus.create({
        data: { tenantId: tenantAId, name: 'Annex', code: 'ANNEX' },
      }),
    ]);
    campus1Id = c1.id;
    campus2Id = c2.id;

    const stage = await owner.stage.create({
      data: { tenantId: tenantAId, name: 'Senior Secondary', code: 'SSS' },
    });
    const year = await owner.yearLevel.create({
      data: {
        tenantId: tenantAId,
        stageId: stage.id,
        name: 'SS1',
        code: 'SS1',
      },
    });
    const ay = await owner.academicYear.create({
      data: {
        tenantId: tenantAId,
        name: `${stamp}-AY`,
        startDate: new Date('2026-09-01'),
        endDate: new Date('2027-07-31'),
        status: 'active',
      },
    });
    yearId = ay.id;

    [sectionA1Id, sectionA2Id, sectionC2Id] = await Promise.all([
      makeSection(tenantAId, campus1Id, year.id, 'A'),
      makeSection(tenantAId, campus1Id, year.id, 'B'),
      makeSection(tenantAId, campus2Id, year.id, 'C'),
    ]);

    [studentId, gradStudentId, scopeStudentId] = await Promise.all([
      makeStudent(tenantAId, 's1'),
      makeStudent(tenantAId, 'grad'),
      makeStudent(tenantAId, 'scope'),
    ]);
  });

  afterAll(async () => {
    if (owner) {
      const inTenants = { tenantId: { in: [tenantAId, tenantBId] } };
      await owner.studentPlacementHistory.deleteMany({ where: inTenants });
      await owner.sectionEnrollment.deleteMany({ where: inTenants });
      await owner.classSection.deleteMany({ where: inTenants });
      await owner.yearLevel.deleteMany({ where: inTenants });
      await owner.stage.deleteMany({ where: inTenants });
      await owner.academicYear.deleteMany({ where: inTenants });
      await owner.student.deleteMany({ where: inTenants });
      await owner.campus.deleteMany({ where: inTenants });
      await owner.userTenant.deleteMany({ where: inTenants });
      await owner.tenant.deleteMany({ where: { slug: { in: [A, B] } } });
      await owner.user.deleteMany({
        where: { email: { contains: `-${stamp}@` } },
      });
      await owner.$disconnect();
    }
    if (app) await app.close();
  });

  it('registers a student into a section as their first active placement', async () => {
    const res = await inA(() =>
      lifecycle.registerStudent(tenantAId, unscoped(), {
        studentId,
        classSectionId: sectionA1Id,
        academicYearId: yearId,
      }),
    );
    expect(res.enrollment.status).toBe('active');
    expect(res.placement.eventType).toBe('registration');

    const explained = await inA(() =>
      lifecycle.explainPlacement(tenantAId, studentId),
    );
    expect(explained.student.enrollmentStatus).toBe('active');
    expect(explained.current?.classSectionId).toBe(sectionA1Id);
    expect(explained.history).toHaveLength(1);

    // Re-registering an already-placed student is rejected (use transfer).
    await expect(
      inA(() =>
        lifecycle.registerStudent(tenantAId, unscoped(), {
          studentId,
          classSectionId: sectionA2Id,
          academicYearId: yearId,
        }),
      ),
    ).rejects.toBeTruthy();
  });

  it('a mid-year transfer keeps BOTH placements with dates', async () => {
    await inA(() =>
      lifecycle.transferStudent(tenantAId, unscoped(), {
        studentId,
        toClassSectionId: sectionA2Id,
        reason: 'Moved to Science arm',
      }),
    );

    const explained = await inA(() =>
      lifecycle.explainPlacement(tenantAId, studentId),
    );
    // Two placement spans survive — the source (ended, with an end date) and the
    // destination (active). The prior placement was NOT destroyed.
    expect(explained.history).toHaveLength(2);
    const source = explained.history.find(
      (h) => h.classSectionId === sectionA1Id,
    );
    const dest = explained.history.find(
      (h) => h.classSectionId === sectionA2Id,
    );
    expect(source?.status).toBe('ended');
    expect(source?.effectiveTo).toBeTruthy();
    expect(dest?.status).toBe('active');
    expect(dest?.eventType).toBe('transfer');
    expect(explained.current?.classSectionId).toBe(sectionA2Id);

    // The source SectionEnrollment is kept (status 'transferred'), not deleted.
    const enrollments = await owner.sectionEnrollment.findMany({
      where: { tenantId: tenantAId, studentId },
    });
    expect(enrollments).toHaveLength(2);
    const src = enrollments.find((e) => e.classSectionId === sectionA1Id);
    expect(src?.status).toBe('transferred');
    expect(src?.endedAt).toBeTruthy();
  });

  it('withdrawal flips lifecycle state and preserves prior placements', async () => {
    await inA(() =>
      lifecycle.withdrawStudent(tenantAId, unscoped(), {
        studentId,
        reason: 'Left the school',
      }),
    );
    const explained = await inA(() =>
      lifecycle.explainPlacement(tenantAId, studentId),
    );
    expect(explained.student.enrollmentStatus).toBe('withdrawn');
    // The two prior placement spans are still present (never destroyed) + a
    // terminal withdrawal event span.
    expect(explained.history.length).toBeGreaterThanOrEqual(3);
    expect(explained.history.some((h) => h.eventType === 'withdrawal')).toBe(
      true,
    );
    // No active section membership remains.
    const active = await owner.sectionEnrollment.findMany({
      where: { tenantId: tenantAId, studentId, status: 'active' },
    });
    expect(active).toHaveLength(0);
  });

  it('graduation flips lifecycle state and is auditable', async () => {
    await inA(() =>
      lifecycle.registerStudent(tenantAId, unscoped(), {
        studentId: gradStudentId,
        classSectionId: sectionA1Id,
        academicYearId: yearId,
      }),
    );
    const res = await inA(() =>
      lifecycle.graduateStudent(tenantAId, unscoped(), {
        studentId: gradStudentId,
      }),
    );
    expect(res.status).toBe('graduated');
    const explained = await inA(() =>
      lifecycle.explainPlacement(tenantAId, gradStudentId),
    );
    expect(explained.student.enrollmentStatus).toBe('graduated');
    expect(explained.student.graduationDate).toBeTruthy();
  });

  it('enforces campus scope on registration', async () => {
    const campus2Actor = {
      userId: actorId,
      grantScope: { type: 'campus', value: campus2Id, label: 'Annex' },
    };
    // sectionA1 is on campus1; a campus2-scoped actor can't register into it.
    await expect(
      inA(() =>
        lifecycle.registerStudent(tenantAId, campus2Actor, {
          studentId: scopeStudentId,
          classSectionId: sectionA1Id,
          academicYearId: yearId,
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    // A campus2-scoped actor CAN register into a campus2 section.
    const ok = await inA(() =>
      lifecycle.registerStudent(tenantAId, campus2Actor, {
        studentId: scopeStudentId,
        classSectionId: sectionC2Id,
        academicYearId: yearId,
      }),
    );
    expect(ok.enrollment.classSectionId).toBe(sectionC2Id);
  });

  it('isolates tenants via RLS and rejects anon at the HTTP boundary', async () => {
    // Tenant B cannot see tenant A's student (RLS hides it).
    await expect(
      inB(() => lifecycle.explainPlacement(tenantBId, studentId)),
    ).rejects.toBeTruthy();
    await expect(
      inB(() =>
        lifecycle.registerStudent(tenantBId, unscoped(), {
          studentId,
          classSectionId: sectionA1Id,
          academicYearId: yearId,
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    const http = app.getHttpServer();
    await request(http)
      .get(`/academics/lifecycle/students/${studentId}/placement`)
      .expect(401);
    await request(http)
      .post('/academics/lifecycle/register')
      .send({})
      .expect(401);
  });
});
