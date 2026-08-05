/**
 * WB2-2 · Enrollment + registration + electives + teacher assignment — behavioural
 * proof on the app_runtime (RLS-enforcing) client.
 *
 * Acceptance (workbench-2 scenario 2 + WB2-2 card):
 *   - a K-12 profile ('class') resolves student→subjects via SECTION enrollment
 *     (the section's offerings = the subject set); an elected offering adds one.
 *   - a tertiary profile ('course') resolves student→subjects via per-offering
 *     CourseRegistration.
 *   - an elective references an OFFERING (electing a non-elective offering is
 *     rejected).
 *   - a teacher is assigned to an OFFERING, not a label.
 *   - the model falls back to Tenant.schoolType when no profile is set.
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
import { EnrollmentService } from '../src/academic-structure/services/enrollment.service';
import { makeSuperuserClient } from './helpers/superuser-client';

const HAS_APP_RUNTIME = !!process.env.APP_RUNTIME_DATABASE_URL;
const d = HAS_APP_RUNTIME ? describe : describe.skip;

d('Enrollment — section/course/election/teacher + resolver (WB2-2)', () => {
  let app: INestApplication;
  let owner: ReturnType<typeof makeSuperuserClient>;
  let tenantDb: TenantDbService;
  let enroll: EnrollmentService;

  const stamp = Date.now();
  const A = `wb22-a-${stamp}`; // K-12
  const B = `wb22-b-${stamp}`; // tertiary

  let tenantAId: string;
  let tenantBId: string;
  let campus1Id: string;
  let campus2Id: string;
  let academicYearAId: string;
  let sectionAId: string;
  let coreOfferingId: string; // Mathematics (isElective=false)
  let electiveOfferingId: string; // Music (isElective=true)
  let studentA1Id: string;
  let studentA2Id: string;
  let teacherProfileId: string;
  let actorId: string;

  // tenant B (tertiary)
  let sectionBId: string;
  let offeringBId: string;
  let studentBId: string;

  const inA = <T>(fn: () => Promise<T>) =>
    tenantDb.runScoped(tenantAId, actorId, fn);
  const inB = <T>(fn: () => Promise<T>) =>
    tenantDb.runScoped(tenantBId, actorId, fn);
  const unscoped = () => ({ userId: actorId, grantScope: null });

  // Create a student (user + profile + student row) in a tenant.
  async function makeStudent(tenantId: string, tag: string) {
    const user = await owner.user.create({
      data: { email: `wb22-${tag}-${stamp}@s.test`, isActive: true },
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

  async function makeOffering(
    tenantId: string,
    classSectionId: string,
    academicYearId: string,
    subjectLabel: string,
    isElective: boolean,
  ) {
    const o = await owner.subjectOffering.create({
      data: {
        tenantId,
        classSectionId,
        academicYearId,
        curriculumSubjectId: `subj-${subjectLabel}-${stamp}`, // soft ref (no FK)
        subjectLabel,
        isElective,
      },
    });
    return o.id;
  }

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();

    owner = makeSuperuserClient();
    tenantDb = app.get(TenantDbService);
    enroll = app.get(EnrollmentService);

    const [ta, tb, actor] = await Promise.all([
      owner.tenant.create({
        data: {
          name: 'WB22 A',
          slug: A,
          status: 'active',
          schoolType: 'secondary',
        },
      }),
      owner.tenant.create({
        data: {
          name: 'WB22 B',
          slug: B,
          status: 'active',
          schoolType: 'university',
        },
      }),
      owner.user.create({
        data: { email: `wb22-actor-${stamp}@a.test`, isActive: true },
      }),
    ]);
    tenantAId = ta.id;
    tenantBId = tb.id;
    actorId = actor.id;

    // ---- tenant A (K-12) structure ----
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

    const stageA = await owner.stage.create({
      data: { tenantId: tenantAId, name: 'Senior Secondary', code: 'SSS' },
    });
    const yearA = await owner.yearLevel.create({
      data: {
        tenantId: tenantAId,
        stageId: stageA.id,
        name: 'SS1',
        code: 'SS1',
      },
    });
    const streamA = await owner.stream.create({
      data: { tenantId: tenantAId, name: 'Science', code: 'SCI' },
    });
    const ayA = await owner.academicYear.create({
      data: {
        tenantId: tenantAId,
        name: `${stamp}-AY`,
        startDate: new Date('2026-09-01'),
        endDate: new Date('2027-07-31'),
        status: 'active',
      },
    });
    academicYearAId = ayA.id;
    const sectionA = await owner.classSection.create({
      data: {
        tenantId: tenantAId,
        campusId: campus1Id,
        yearLevelId: yearA.id,
        streamId: streamA.id,
        name: 'A',
        displayLabel: 'SS1 Science A',
      },
    });
    sectionAId = sectionA.id;

    coreOfferingId = await makeOffering(
      tenantAId,
      sectionAId,
      academicYearAId,
      'Mathematics',
      false,
    );
    electiveOfferingId = await makeOffering(
      tenantAId,
      sectionAId,
      academicYearAId,
      'Music',
      true,
    );

    [studentA1Id, studentA2Id] = await Promise.all([
      makeStudent(tenantAId, 's1'),
      makeStudent(tenantAId, 's2'),
    ]);

    // Teacher profile in tenant A.
    const teacherUser = await owner.user.create({
      data: { email: `wb22-teacher-${stamp}@a.test`, isActive: true },
    });
    const teacherUt = await owner.userTenant.create({
      data: { userId: teacherUser.id, tenantId: tenantAId, status: 'active' },
    });
    teacherProfileId = teacherUt.id;

    // ---- tenant B (tertiary) structure ----
    const cB = await owner.campus.create({
      data: {
        tenantId: tenantBId,
        name: 'Main',
        code: 'MAIN',
        isPrimary: true,
      },
    });
    const stageB = await owner.stage.create({
      data: { tenantId: tenantBId, name: 'Undergrad', code: 'UG' },
    });
    const yearB = await owner.yearLevel.create({
      data: {
        tenantId: tenantBId,
        stageId: stageB.id,
        name: 'Year 1',
        code: 'Y1',
      },
    });
    const ayB = await owner.academicYear.create({
      data: {
        tenantId: tenantBId,
        name: `${stamp}-AYB`,
        startDate: new Date('2026-09-01'),
        endDate: new Date('2027-07-31'),
        status: 'active',
      },
    });
    const sectionB = await owner.classSection.create({
      data: {
        tenantId: tenantBId,
        campusId: cB.id,
        yearLevelId: yearB.id,
        name: 'Cohort',
        displayLabel: 'Year 1 Cohort',
      },
    });
    sectionBId = sectionB.id;
    offeringBId = await makeOffering(
      tenantBId,
      sectionBId,
      ayB.id,
      'Calculus',
      false,
    );
    studentBId = await makeStudent(tenantBId, 'sb');
  });

  afterAll(async () => {
    if (owner) {
      const inTenants = { tenantId: { in: [tenantAId, tenantBId] } };
      await owner.sectionEnrollment.deleteMany({ where: inTenants });
      await owner.courseRegistration.deleteMany({ where: inTenants });
      await owner.studentSubjectElection.deleteMany({ where: inTenants });
      await owner.offeringTeacher.deleteMany({ where: inTenants });
      await owner.academicProfile.deleteMany({ where: inTenants });
      await owner.subjectOffering.deleteMany({ where: inTenants });
      await owner.classSection.deleteMany({ where: inTenants });
      await owner.yearLevel.deleteMany({ where: inTenants });
      await owner.stream.deleteMany({ where: inTenants });
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

  it('falls back to Tenant.schoolType when no profile exists', async () => {
    const resolved = await inA(() => enroll.resolveEnrollmentModel(tenantAId));
    expect(resolved).toEqual({ model: 'class', source: 'schoolType' });
    const resolvedB = await inB(() => enroll.resolveEnrollmentModel(tenantBId));
    expect(resolvedB).toEqual({ model: 'course', source: 'schoolType' });
  });

  it('K-12: a class profile resolves student→subjects via section enrollment', async () => {
    await inA(() =>
      enroll.createProfile(tenantAId, actorId, {
        name: 'K-12',
        enrollmentModel: 'class',
        isDefault: true,
      }),
    );
    const model = await inA(() => enroll.resolveEnrollmentModel(tenantAId));
    expect(model).toEqual({ model: 'class', source: 'profile' });

    await inA(() =>
      enroll.enrollSection(tenantAId, unscoped(), {
        studentId: studentA1Id,
        classSectionId: sectionAId,
        academicYearId: academicYearAId,
      }),
    );

    const resolved = await inA(() =>
      enroll.resolveStudentSubjects(tenantAId, studentA1Id),
    );
    expect(resolved.model).toBe('class');
    // The section's CORE offering (Mathematics) is in the set; the elective
    // (Music) is NOT until elected.
    const labels = resolved.subjects.map(
      (s) => `${s.subjectLabel}:${s.source}`,
    );
    expect(labels).toContain('Mathematics:core');
    expect(labels).not.toContain('Music:core');
    expect(labels).not.toContain('Music:elective');
  });

  it('an elective references an OFFERING and joins the resolved set', async () => {
    // Electing a NON-elective offering is rejected.
    await expect(
      inA(() =>
        enroll.electSubject(tenantAId, unscoped(), {
          studentId: studentA1Id,
          subjectOfferingId: coreOfferingId,
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    // Electing the elective offering succeeds and shows up as 'elective'.
    await inA(() =>
      enroll.electSubject(tenantAId, unscoped(), {
        studentId: studentA1Id,
        subjectOfferingId: electiveOfferingId,
      }),
    );
    const resolved = await inA(() =>
      enroll.resolveStudentSubjects(tenantAId, studentA1Id),
    );
    const labels = resolved.subjects.map(
      (s) => `${s.subjectLabel}:${s.source}`,
    );
    expect(labels).toContain('Music:elective');
  });

  it('assigns a teacher to an OFFERING, not a label', async () => {
    const assignment = await inA(() =>
      enroll.assignTeacher(tenantAId, unscoped(), {
        subjectOfferingId: coreOfferingId,
        userTenantId: teacherProfileId,
      }),
    );
    expect(assignment.subjectOfferingId).toBe(coreOfferingId);
    const teachers = await inA(() =>
      enroll.listOfferingTeachers(tenantAId, {
        subjectOfferingId: coreOfferingId,
      }),
    );
    expect(teachers.map((t) => t.userTenantId)).toContain(teacherProfileId);
  });

  it('tertiary: a course profile resolves student→subjects via per-course registration', async () => {
    await inB(() =>
      enroll.createProfile(tenantBId, actorId, {
        name: 'Tertiary',
        enrollmentModel: 'course',
        isDefault: true,
      }),
    );
    await inB(() =>
      enroll.registerCourse(tenantBId, unscoped(), {
        studentId: studentBId,
        subjectOfferingId: offeringBId,
      }),
    );
    const resolved = await inB(() =>
      enroll.resolveStudentSubjects(tenantBId, studentBId),
    );
    expect(resolved.model).toBe('course');
    expect(
      resolved.subjects.map((s) => `${s.subjectLabel}:${s.source}`),
    ).toContain('Calculus:registered');
  });

  it('enforces campus scope on section enrollment', async () => {
    const campus2Actor = {
      userId: actorId,
      grantScope: { type: 'campus', value: campus2Id, label: 'Annex' },
    };
    // The section is on campus1; a campus2-scoped actor can't enroll into it.
    await expect(
      inA(() =>
        enroll.enrollSection(tenantAId, campus2Actor, {
          studentId: studentA2Id,
          classSectionId: sectionAId,
          academicYearId: academicYearAId,
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    // A campus1-scoped actor can.
    const campus1Actor = {
      userId: actorId,
      grantScope: { type: 'campus', value: campus1Id, label: 'Main' },
    };
    const ok = await inA(() =>
      enroll.enrollSection(tenantAId, campus1Actor, {
        studentId: studentA2Id,
        classSectionId: sectionAId,
        academicYearId: academicYearAId,
      }),
    );
    expect(ok.classSectionId).toBe(sectionAId);
  });

  it('isolates tenants via RLS and rejects anon at the HTTP boundary', async () => {
    // Tenant B cannot enroll against tenant A's section (RLS hides it).
    await expect(
      inB(() =>
        enroll.enrollSection(tenantBId, unscoped(), {
          studentId: studentBId,
          classSectionId: sectionAId,
          academicYearId: academicYearAId,
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    const http = app.getHttpServer();
    await request(http).get('/academics/enrollment/profiles').expect(401);
    await request(http)
      .post('/academics/enrollment/sections')
      .send({})
      .expect(401);
  });
});
