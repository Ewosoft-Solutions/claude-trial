/**
 * WB3-1/WB3-2 · Admissions pipeline + one-command conversion to a registered
 * student — behavioural proof on the app_runtime (RLS-enforcing) client.
 *
 * Acceptance (workbench-3):
 *   - an application is a durable pipeline record; every stage transition writes
 *     an auditable AdmissionStageEvent (history, not a silent overwrite).
 *   - a reviewer records a SCORED decision; the review history is kept.
 *   - offer → accept → CONVERT creates a Person + login-less profile + Student
 *     (allocated number) and REGISTERS them into a section via the WB2-3
 *     lifecycle (a registration placement span); the application flips to
 *     'enrolled' with a resultingStudentId.
 *   - converting a non-accepted or already-converted application is refused.
 *   - campus scope is enforced on convert; RLS isolates tenants; HTTP 401.
 *
 * Requires APP_RUNTIME_DATABASE_URL; skips otherwise.
 */
import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  INestApplication,
} from '@nestjs/common';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { TenantDbService } from '../src/common';
import { AdmissionsService } from '../src/admissions/services/admissions.service';
import { makeSuperuserClient } from './helpers/superuser-client';

const HAS_APP_RUNTIME = !!process.env.APP_RUNTIME_DATABASE_URL;
const d = HAS_APP_RUNTIME ? describe : describe.skip;

d('Admissions — pipeline + convert to student (WB3)', () => {
  let app: INestApplication;
  let owner: ReturnType<typeof makeSuperuserClient>;
  let tenantDb: TenantDbService;
  let admissions: AdmissionsService;

  const stamp = Date.now();
  const A = `wb3-a-${stamp}`;
  const B = `wb3-b-${stamp}`;

  let tenantAId: string;
  let tenantBId: string;
  let campus1Id: string;
  let campus2Id: string;
  let yearId: string;
  let section1Id: string; // campus1
  let section2Id: string; // campus2
  let actorId: string;

  let appId: string; // the main application converted to a student
  let convertedStudentId: string;

  const inA = <T>(fn: () => Promise<T>) =>
    tenantDb.runScoped(tenantAId, actorId, fn);
  const inB = <T>(fn: () => Promise<T>) =>
    tenantDb.runScoped(tenantBId, actorId, fn);
  const unscoped = () => ({ userId: actorId, grantScope: null });

  async function makeApplication(tag: string) {
    return inA(() =>
      admissions.createApplication(
        tenantAId,
        {
          applicantName: `Ada ${tag} Okoro`,
          applyingFor: 'Primary 5',
          guardianName: 'Mrs Okoro',
          guardianEmail: `okoro-${tag}-${stamp}@guardian.test`,
        },
        actorId,
      ),
    );
  }

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();

    owner = makeSuperuserClient();
    tenantDb = app.get(TenantDbService);
    admissions = app.get(AdmissionsService);

    const [ta, tb, actor] = await Promise.all([
      owner.tenant.create({
        data: {
          name: 'WB3 A',
          slug: A,
          status: 'active',
          schoolType: 'secondary',
        },
      }),
      owner.tenant.create({
        data: {
          name: 'WB3 B',
          slug: B,
          status: 'active',
          schoolType: 'secondary',
        },
      }),
      owner.user.create({
        data: { email: `wb3-actor-${stamp}@a.test`, isActive: true },
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
      data: { tenantId: tenantAId, name: 'Primary', code: 'PRI' },
    });
    const year = await owner.yearLevel.create({
      data: {
        tenantId: tenantAId,
        stageId: stage.id,
        name: 'Primary 5',
        code: 'P5',
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
    const [s1, s2] = await Promise.all([
      owner.classSection.create({
        data: {
          tenantId: tenantAId,
          campusId: campus1Id,
          yearLevelId: year.id,
          name: 'A',
          displayLabel: 'Primary 5 A',
        },
      }),
      owner.classSection.create({
        data: {
          tenantId: tenantAId,
          campusId: campus2Id,
          yearLevelId: year.id,
          name: 'B',
          displayLabel: 'Primary 5 B',
        },
      }),
    ]);
    section1Id = s1.id;
    section2Id = s2.id;
  });

  afterAll(async () => {
    if (owner) {
      const inTenants = { tenantId: { in: [tenantAId, tenantBId] } };
      // Collect the placeholder users created by conversion for cleanup.
      const profiles = await owner.userTenant.findMany({
        where: inTenants,
        select: { id: true, userId: true },
      });
      const userIds = profiles.map((p) => p.userId);
      await owner.admissionStageEvent.deleteMany({ where: inTenants });
      await owner.admissionReview.deleteMany({ where: inTenants });
      await owner.admissionApplication.deleteMany({ where: inTenants });
      await owner.studentPlacementHistory.deleteMany({ where: inTenants });
      await owner.sectionEnrollment.deleteMany({ where: inTenants });
      await owner.student.deleteMany({ where: inTenants });
      await owner.classSection.deleteMany({ where: inTenants });
      await owner.yearLevel.deleteMany({ where: inTenants });
      await owner.stage.deleteMany({ where: inTenants });
      await owner.academicYear.deleteMany({ where: inTenants });
      await owner.person.deleteMany({ where: inTenants });
      await owner.campus.deleteMany({ where: inTenants });
      await owner.userTenant.deleteMany({ where: inTenants });
      if (userIds.length) {
        await owner.user.deleteMany({ where: { id: { in: userIds } } });
      }
      await owner.tenant.deleteMany({ where: { slug: { in: [A, B] } } });
      await owner.user.deleteMany({
        where: { email: { contains: `-${stamp}@` } },
      });
      await owner.$disconnect();
    }
    if (app) await app.close();
  });

  it('an application is a durable pipeline record with stage history', async () => {
    const application = await makeApplication('pipe');
    appId = application.id;
    expect(application.stage).toBe('applied');

    await inA(() =>
      admissions.advanceStage(
        tenantAId,
        appId,
        { toStage: 'screening' },
        actorId,
      ),
    );
    await inA(() =>
      admissions.advanceStage(
        tenantAId,
        appId,
        { toStage: 'interview' },
        actorId,
      ),
    );

    const full = await inA(() => admissions.getApplication(tenantAId, appId));
    expect(full.stage).toBe('interview');
    // submitted -> applied, applied -> screening, screening -> interview = 3 events.
    expect(full.stageEvents.length).toBe(3);
    expect(full.stageEvents.map((e) => e.toStage)).toEqual([
      'applied',
      'screening',
      'interview',
    ]);
  });

  it('records scored reviews as kept decision history', async () => {
    await inA(() =>
      admissions.addReview(
        tenantAId,
        appId,
        { score: 74, recommendation: 'hold', note: 'Borderline' },
        actorId,
      ),
    );
    await inA(() =>
      admissions.addReview(
        tenantAId,
        appId,
        { score: 88, recommendation: 'recommend', note: 'Strong retest' },
        actorId,
      ),
    );
    const full = await inA(() => admissions.getApplication(tenantAId, appId));
    expect(full.reviews.length).toBe(2);
    // Both reviews are kept (history, not overwrite); newest first.
    expect(full.reviews[0]!.recommendation).toBe('recommend');
    expect(full.reviews[0]!.score).toBe(88);
  });

  it('advance cannot reach a terminal stage (use the dedicated action)', async () => {
    await expect(
      inA(() =>
        admissions.advanceStage(
          tenantAId,
          appId,
          { toStage: 'offer' },
          actorId,
        ),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('advance cannot regress a decided/terminal application (no undoing a reject)', async () => {
    // A rejected application cannot be advanced back into the pipeline — this is
    // the stage-machine + privilege-boundary fix (advance is clearance-review
    // level; reject is a higher-clearance decision).
    const rejected = await makeApplication('regress');
    await inA(() =>
      admissions.reject(tenantAId, rejected.id, { note: 'Below bar' }, actorId),
    );
    await expect(
      inA(() =>
        admissions.advanceStage(
          tenantAId,
          rejected.id,
          { toStage: 'screening' },
          actorId,
        ),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    // …and an offered application cannot be regressed by advance either.
    const offered = await makeApplication('offered');
    await inA(() => admissions.makeOffer(tenantAId, offered.id, {}, actorId));
    await expect(
      inA(() =>
        admissions.advanceStage(
          tenantAId,
          offered.id,
          { toStage: 'interview' },
          actorId,
        ),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('convert is refused before acceptance', async () => {
    await expect(
      inA(() =>
        admissions.convertToStudent(tenantAId, unscoped(), appId, {
          classSectionId: section1Id,
          academicYearId: yearId,
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('offer → accept → one-command conversion creates a registered student', async () => {
    await inA(() =>
      admissions.makeOffer(
        tenantAId,
        appId,
        { targetClassSectionId: section1Id, academicYearId: yearId },
        actorId,
      ),
    );
    await inA(() => admissions.recordAcceptance(tenantAId, appId, actorId));

    const result = await inA(() =>
      admissions.convertToStudent(tenantAId, unscoped(), appId, {
        classSectionId: section1Id,
        academicYearId: yearId,
      }),
    );
    convertedStudentId = result.studentId;
    expect(result.studentNumber).toMatch(/^STU-/);

    // A Student exists, active, linked to a Person.
    const student = await owner.student.findFirst({
      where: { id: convertedStudentId, tenantId: tenantAId },
    });
    expect(student?.enrollmentStatus).toBe('active');
    expect(student?.personId).toBe(result.personId);

    // Registered into the section via the WB2-3 lifecycle (enrollment + span).
    const enrollment = await owner.sectionEnrollment.findFirst({
      where: {
        tenantId: tenantAId,
        studentId: convertedStudentId,
        classSectionId: section1Id,
        academicYearId: yearId,
      },
    });
    expect(enrollment?.status).toBe('active');
    const span = await owner.studentPlacementHistory.findFirst({
      where: {
        tenantId: tenantAId,
        studentId: convertedStudentId,
        eventType: 'registration',
      },
    });
    expect(span).toBeTruthy();

    // The application closed out to 'enrolled' with the resulting student.
    const full = await inA(() => admissions.getApplication(tenantAId, appId));
    expect(full.stage).toBe('enrolled');
    expect(full.resultingStudentId).toBe(convertedStudentId);
    expect(full.stageEvents.some((e) => e.toStage === 'enrolled')).toBe(true);
  });

  it('a second conversion of the same application is refused', async () => {
    await expect(
      inA(() =>
        admissions.convertToStudent(tenantAId, unscoped(), appId, {
          classSectionId: section1Id,
          academicYearId: yearId,
        }),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('enforces campus scope on conversion', async () => {
    // A fresh application taken to 'accepted'.
    const application = await makeApplication('scope');
    const id = application.id;
    await inA(() => admissions.makeOffer(tenantAId, id, {}, actorId));
    await inA(() => admissions.recordAcceptance(tenantAId, id, actorId));

    // section1 is on campus1; a campus2-scoped actor cannot convert into it.
    const campus2Actor = {
      userId: actorId,
      grantScope: { type: 'campus', value: campus2Id, label: 'Annex' },
    };
    await expect(
      inA(() =>
        admissions.convertToStudent(tenantAId, campus2Actor, id, {
          classSectionId: section1Id,
          academicYearId: yearId,
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    // …but can convert into a campus2 section.
    const ok = await inA(() =>
      admissions.convertToStudent(tenantAId, campus2Actor, id, {
        classSectionId: section2Id,
        academicYearId: yearId,
      }),
    );
    expect(ok.studentId).toBeTruthy();
  });

  it('isolates tenants via RLS and rejects anon at the HTTP boundary', async () => {
    // Tenant B cannot see tenant A's application (RLS hides it).
    await expect(
      inB(() => admissions.getApplication(tenantBId, appId)),
    ).rejects.toBeTruthy();

    const http = app.getHttpServer();
    await request(http).get('/admissions/applications').expect(401);
    await request(http)
      .post(`/admissions/applications/${appId}/convert`)
      .send({})
      .expect(401);
  });
});
