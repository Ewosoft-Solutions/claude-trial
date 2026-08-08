/**
 * WB4 · Results parity / ResultCycle (ADR-04) — behavioural proof on the
 * app_runtime (RLS-enforcing) client.
 *
 * Acceptance (ADR-04 validation):
 *   - a cycle is configured (components + sections + scale + remark set +
 *     promotion policy), opened, scored, and validated for completeness;
 *   - publish is maker-checker gated: the MAKER cannot approve their own publish;
 *     a SECOND approver publishes an IMMUTABLE, checksum-addressed snapshot;
 *   - an ABSENT learner has no percentage and is NOT zeroed;
 *   - editing the grade scale AFTER publish leaves the prior snapshot unchanged;
 *   - a correction is an AMENDMENT (a new version) — both versions survive, the
 *     original is superseded (never overwritten);
 *   - a FinancialHold gates guardian visibility (audited), never a silent blank;
 *   - RLS isolates tenants; HTTP 401 at the boundary.
 *
 * Requires APP_RUNTIME_DATABASE_URL; skips otherwise.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, INestApplication } from '@nestjs/common';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { TenantDbService } from '../src/common';
import { ResultCycleService } from '../src/results/services/result-cycle.service';
import { ResultEntryService } from '../src/results/services/result-entry.service';
import { ResultPublicationService } from '../src/results/services/result-publication.service';
import { FinancialHoldService } from '../src/results/services/financial-hold.service';
import type { ResultActor } from '../src/results/services/results.types';
import { JobWorker } from '../src/common/jobs/job.worker';
import { makeSuperuserClient } from './helpers/superuser-client';

const HAS_APP_RUNTIME = !!process.env.APP_RUNTIME_DATABASE_URL;
const d = HAS_APP_RUNTIME ? describe : describe.skip;

d('Results workbench — ResultCycle publish/amend/hold (WB4)', () => {
  let app: INestApplication;
  let owner: ReturnType<typeof makeSuperuserClient>;
  let tenantDb: TenantDbService;
  let cycles: ResultCycleService;
  let entries: ResultEntryService;
  let publications: ResultPublicationService;
  let holds: FinancialHoldService;
  let worker: JobWorker;

  const stamp = Date.now();
  const A = `wb4-a-${stamp}`;
  const B = `wb4-b-${stamp}`;

  let tenantAId: string;
  let tenantBId: string;
  let campusId: string;
  let yearId: string;
  let termId: string;
  let sectionId: string;
  let mathOfferingId: string;
  let englishOfferingId: string;
  let gradingSystemId: string;
  let remarkSetId: string;
  let adaId: string;
  let bolaId: string;
  let makerId: string;
  let checkerId: string;

  const maker = (): ResultActor => ({
    userId: makerId,
    clearanceLevel: 7,
    grantScope: null,
  });
  const checker = (): ResultActor => ({
    userId: checkerId,
    clearanceLevel: 7,
    grantScope: null,
  });

  const inA = <T>(fn: () => Promise<T>) =>
    tenantDb.runScoped(tenantAId, makerId, fn);
  const inB = <T>(fn: () => Promise<T>) =>
    tenantDb.runScoped(tenantBId, makerId, fn);

  const SCALE = {
    A: { min: 75, max: 100, points: 4, label: 'Excellent' },
    B: { min: 60, max: 74, points: 3, label: 'Very good' },
    C: { min: 50, max: 59, points: 2, label: 'Credit' },
    P: { min: 40, max: 49, points: 1, label: 'Pass' },
    F: { min: 0, max: 39, points: 0, label: 'Fail' },
  };

  async function makeStudent(tag: string, first: string) {
    const user = await owner.user.create({
      data: {
        email: `wb4-${tag}-${stamp}@s.test`,
        firstName: first,
        lastName: 'Test',
        isActive: true,
      },
    });
    const ut = await owner.userTenant.create({
      data: { userId: user.id, tenantId: tenantAId, status: 'active' },
    });
    const student = await owner.student.create({
      data: {
        tenantId: tenantAId,
        userTenantId: ut.id,
        studentNumber: `STU-${tag}-${stamp}`,
        enrollmentStatus: 'active',
      },
    });
    await owner.sectionEnrollment.create({
      data: {
        tenantId: tenantAId,
        studentId: student.id,
        classSectionId: sectionId,
        academicYearId: yearId,
        status: 'active',
      },
    });
    return student.id;
  }

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();

    owner = makeSuperuserClient();
    tenantDb = app.get(TenantDbService);
    cycles = app.get(ResultCycleService);
    entries = app.get(ResultEntryService);
    publications = app.get(ResultPublicationService);
    holds = app.get(FinancialHoldService);
    worker = app.get(JobWorker);

    const [ta, tb, mk, ck] = await Promise.all([
      owner.tenant.create({
        data: {
          name: 'WB4 A',
          slug: A,
          status: 'active',
          schoolType: 'secondary',
        },
      }),
      owner.tenant.create({
        data: {
          name: 'WB4 B',
          slug: B,
          status: 'active',
          schoolType: 'secondary',
        },
      }),
      owner.user.create({
        data: { email: `wb4-maker-${stamp}@a.test`, isActive: true },
      }),
      owner.user.create({
        data: { email: `wb4-checker-${stamp}@a.test`, isActive: true },
      }),
    ]);
    tenantAId = ta.id;
    tenantBId = tb.id;
    makerId = mk.id;
    checkerId = ck.id;

    const campus = await owner.campus.create({
      data: {
        tenantId: tenantAId,
        name: 'Main',
        code: 'MAIN',
        isPrimary: true,
      },
    });
    campusId = campus.id;
    const stage = await owner.stage.create({
      data: { tenantId: tenantAId, name: 'Senior Secondary', code: 'SSS' },
    });
    const yl = await owner.yearLevel.create({
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
        name: `${stamp}-AY1`,
        startDate: new Date('2026-09-01'),
        endDate: new Date('2027-07-31'),
        status: 'active',
      },
    });
    yearId = ay.id;
    const term = await owner.term.create({
      data: {
        academicYearId: ay.id,
        tenantId: tenantAId,
        name: 'First Term',
        type: 'term',
        startDate: new Date('2026-09-01'),
        endDate: new Date('2026-12-15'),
        order: 1,
        status: 'active',
      },
    });
    termId = term.id;
    const section = await owner.classSection.create({
      data: {
        tenantId: tenantAId,
        campusId,
        yearLevelId: yl.id,
        name: 'A',
        displayLabel: 'SS1 A',
      },
    });
    sectionId = section.id;

    const [math, english] = await Promise.all([
      owner.subjectOffering.create({
        data: {
          tenantId: tenantAId,
          classSectionId: sectionId,
          academicYearId: yearId,
          termId,
          curriculumSubjectId: `cs-math-${stamp}`,
          subjectLabel: 'Mathematics',
        },
      }),
      owner.subjectOffering.create({
        data: {
          tenantId: tenantAId,
          classSectionId: sectionId,
          academicYearId: yearId,
          termId,
          curriculumSubjectId: `cs-eng-${stamp}`,
          subjectLabel: 'English',
        },
      }),
    ]);
    mathOfferingId = math.id;
    englishOfferingId = english.id;

    const gs = await owner.gradingSystem.create({
      data: {
        tenantId: tenantAId,
        name: `WAEC-like ${stamp}`,
        systemType: 'letter_grade',
        gradeScale: SCALE,
      },
    });
    gradingSystemId = gs.id;

    const remarkSet = await owner.remarkRuleSet.create({
      data: {
        tenantId: tenantAId,
        name: `Subject remarks ${stamp}`,
        kind: 'subject',
        rules: {
          create: [
            {
              tenantId: tenantAId,
              minPercentage: 75,
              maxPercentage: 100,
              comment: 'Excellent',
              order: 0,
            },
            {
              tenantId: tenantAId,
              minPercentage: 40,
              maxPercentage: 74,
              comment: 'Good, keep going',
              order: 1,
            },
            {
              tenantId: tenantAId,
              minPercentage: 0,
              maxPercentage: 39,
              comment: 'Needs improvement',
              order: 2,
            },
          ],
        },
      },
    });
    remarkSetId = remarkSet.id;

    [adaId, bolaId] = await Promise.all([
      makeStudent('ada', 'Ada'),
      makeStudent('bola', 'Bola'),
    ]);
  });

  afterAll(async () => {
    if (owner) {
      const inTenants = { tenantId: { in: [tenantAId, tenantBId] } };
      // Artifact documents rendered by the F3 job (versions cascade).
      await owner.document.deleteMany({
        where: { ...inTenants, ownerType: 'ResultPublication' },
      });
      await owner.publishedStudentResult.deleteMany({ where: inTenants });
      await owner.resultAmendment.deleteMany({ where: inTenants });
      await owner.resultPublication.deleteMany({ where: inTenants });
      await owner.resultEntry.deleteMany({ where: inTenants });
      await owner.resultComponent.deleteMany({ where: inTenants });
      await owner.resultCycleSection.deleteMany({ where: inTenants });
      await owner.financialHold.deleteMany({ where: inTenants });
      await owner.resultCycle.deleteMany({ where: inTenants });
      await owner.remarkRule.deleteMany({ where: inTenants });
      await owner.remarkRuleSet.deleteMany({ where: inTenants });
      await owner.gradingSystem.deleteMany({ where: inTenants });
      await owner.subjectOffering.deleteMany({ where: inTenants });
      await owner.sectionEnrollment.deleteMany({ where: inTenants });
      await owner.makerCheckerRequest.deleteMany({ where: inTenants });
      await owner.classSection.deleteMany({ where: inTenants });
      await owner.yearLevel.deleteMany({ where: inTenants });
      await owner.stage.deleteMany({ where: inTenants });
      await owner.term.deleteMany({ where: inTenants });
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

  let cycleId: string;
  let publicationV1Checksum: string;

  it('configures a cycle, opens entry, and captures scores (absent ≠ zero)', async () => {
    const cycle = await inA(() =>
      cycles.createCycle(tenantAId, maker(), {
        name: 'First Term Results',
        academicYearId: yearId,
        termId,
        campusId,
      }),
    );
    cycleId = cycle.id;

    await inA(() =>
      cycles.configureComponents(tenantAId, maker(), cycleId, {
        components: [
          { key: 'CA1', label: 'First CA', maxScore: 20 },
          { key: 'CA2', label: 'Second CA', maxScore: 20 },
          { key: 'EXAM', label: 'Exam', maxScore: 60, isExam: true },
        ],
      }),
    );
    await inA(() =>
      cycles.setSections(tenantAId, maker(), cycleId, {
        classSectionIds: [sectionId],
      }),
    );
    await inA(() =>
      cycles.updateCycle(tenantAId, maker(), cycleId, {
        gradingSystemId,
        subjectRemarkRuleSetId: remarkSetId,
        promotionPolicy: { passMark: 40, maxFailedSubjects: 1 },
      }),
    );
    await inA(() => cycles.openEntry(tenantAId, maker(), cycleId));

    // Ada: full scores in both subjects. Bola: full Maths, ABSENT for English.
    const full = (
      studentId: string,
      offeringId: string,
      ca1: number,
      ca2: number,
      exam: number,
    ) => [
      {
        studentId,
        subjectOfferingId: offeringId,
        componentKey: 'CA1',
        score: ca1,
      },
      {
        studentId,
        subjectOfferingId: offeringId,
        componentKey: 'CA2',
        score: ca2,
      },
      {
        studentId,
        subjectOfferingId: offeringId,
        componentKey: 'EXAM',
        score: exam,
      },
    ];
    const absent = (studentId: string, offeringId: string) =>
      ['CA1', 'CA2', 'EXAM'].map((componentKey) => ({
        studentId,
        subjectOfferingId: offeringId,
        componentKey,
        score: null,
        isAbsent: true,
      }));

    await inA(() =>
      entries.upsertEntries(tenantAId, maker(), cycleId, {
        entries: [
          ...full(adaId, mathOfferingId, 18, 16, 50), // 84 → A
          ...full(adaId, englishOfferingId, 15, 14, 40), // 69 → B
          ...full(bolaId, mathOfferingId, 12, 12, 16), // 40 → P
          ...absent(bolaId, englishOfferingId), // ABSENT (not zero)
        ],
      }),
    );

    const validation = await inA(() =>
      cycles.validateCycle(tenantAId, maker(), cycleId),
    );
    expect(validation.complete).toBe(true);
    expect(validation.missing).toBe(0);
    expect(validation.absent).toBe(3); // Bola's 3 English cells
  });

  it('publish is maker-checker gated: the maker cannot approve their own', async () => {
    await inA(() => cycles.closeEntry(tenantAId, maker(), cycleId));
    await inA(() => cycles.moveToModeration(tenantAId, maker(), cycleId));
    const req = await inA(() =>
      publications.requestPublish(tenantAId, maker(), cycleId),
    );
    expect(req.status).toBe('pending_approval');
    expect(req.approvalRequestId).toBeTruthy();

    await expect(
      inA(() => publications.approveAndPublish(tenantAId, maker(), cycleId)),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('a second approver publishes an immutable snapshot; absent ≠ zero', async () => {
    const result = await inA(() =>
      publications.approveAndPublish(tenantAId, checker(), cycleId),
    );
    expect(result.status).toBe('published');
    expect(result.version).toBe(1);
    expect(result.checksum).toMatch(/^[a-f0-9]{64}$/);
    expect(result.studentCount).toBe(2);
    publicationV1Checksum = result.checksum;

    const pubs = await inA(() =>
      publications.listPublications(tenantAId, checker(), cycleId),
    );
    expect(pubs).toHaveLength(1);

    const { students } = await inA(() =>
      publications.getPublication(tenantAId, checker(), pubs[0]!.id),
    );
    const ada = students.find((s) => s.studentId === adaId)!;
    const bola = students.find((s) => s.studentId === bolaId)!;

    // Ada: Maths 84 → A, English 69 → B, average 76.5 → A, promote.
    const adaMath = (ada.subjects as any[]).find(
      (s) => s.subjectOfferingId === mathOfferingId,
    );
    expect(Number(adaMath.percentage)).toBe(84);
    expect(adaMath.letterGrade).toBe('A');
    expect(adaMath.remark).toBe('Excellent');
    expect(ada.promotionRecommendation).toBe('promote');

    // Bola: English ABSENT — no percentage, NOT zeroed.
    const bolaEng = (bola.subjects as any[]).find(
      (s) => s.subjectOfferingId === englishOfferingId,
    );
    expect(bolaEng.percentage).toBeNull();
    expect(bolaEng.total).toBeNull();
    // An absent subject → the recommendation is a human "review", not a fail.
    expect(bola.promotionRecommendation).toBe('review');
  });

  it('renders report-card + broadsheet artifacts off the request (F3 job)', async () => {
    // The worker is off in tests; drain it deterministically. Publish enqueued
    // one artifact job per section (here, one) — plus the document-scan jobs each
    // uploaded artifact triggers.
    for (let i = 0; i < 100; i++) {
      if (!(await worker.processOnce())) break;
    }
    const pubs = await inA(() =>
      publications.listPublications(tenantAId, checker(), cycleId),
    );
    const v1 = pubs.find((p) => p.version === 1)!;
    // A single-section cycle pins its broadsheet on the publication.
    expect(v1.broadsheetDocumentId).toBeTruthy();

    const { students } = await inA(() =>
      publications.getPublication(tenantAId, checker(), v1.id),
    );
    for (const s of students) {
      expect(s.reportCardDocumentId).toBeTruthy();
    }
    // The artifacts are real stored DocumentArtifacts owned by the publication
    // (2 report cards + 1 broadsheet).
    const docs = await owner.document.findMany({
      where: {
        tenantId: tenantAId,
        ownerType: 'ResultPublication',
        ownerId: v1.id,
      },
    });
    expect(docs.length).toBeGreaterThanOrEqual(students.length + 1);
  });

  it('editing the grade scale after publish leaves the snapshot unchanged', async () => {
    // Mutate the live GradingSystem — a historical report card must not shift.
    await owner.gradingSystem.update({
      where: { id: gradingSystemId },
      data: {
        gradeScale: { A: { min: 90, max: 100 }, F: { min: 0, max: 89 } },
      },
    });
    const pubs = await inA(() =>
      publications.listPublications(tenantAId, checker(), cycleId),
    );
    const v1 = pubs.find((p) => p.version === 1)!;
    expect(v1.checksum).toBe(publicationV1Checksum); // unchanged

    const { students } = await inA(() =>
      publications.getPublication(tenantAId, checker(), v1.id),
    );
    const ada = students.find((s) => s.studentId === adaId)!;
    const adaMath = (ada.subjects as any[]).find(
      (s) => s.subjectOfferingId === mathOfferingId,
    );
    // 84% is still an "A" in the SNAPSHOT scale, even though the live scale now
    // says 84 is an "F". History is reproducible.
    expect(adaMath.letterGrade).toBe('A');
  });

  let amendmentId: string;

  it('a correction is an amendment (new version), maker cannot self-approve', async () => {
    const req = await inA(() =>
      publications.requestAmendment(tenantAId, maker(), cycleId, {
        reason: 'Exam remark error on Ada’s Maths',
        changes: [
          {
            studentId: adaId,
            subjectOfferingId: mathOfferingId,
            componentKey: 'EXAM',
            score: 55, // 50 → 55, Maths 84 → 89
          },
        ],
      }),
    );
    amendmentId = (req as { amendmentId: string }).amendmentId;
    expect(amendmentId).toBeTruthy();

    await expect(
      inA(() => publications.approveAmendment(tenantAId, maker(), amendmentId)),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('the second approver applies the amendment: v2 supersedes v1, both survive', async () => {
    const result = await inA(() =>
      publications.approveAmendment(tenantAId, checker(), amendmentId),
    );
    expect(result.status).toBe('applied');
    expect(result.version).toBe(2);

    const pubs = await inA(() =>
      publications.listPublications(tenantAId, checker(), cycleId),
    );
    expect(pubs).toHaveLength(2);
    const v1 = pubs.find((p) => p.version === 1)!;
    const v2 = pubs.find((p) => p.version === 2)!;
    expect(v1.status).toBe('superseded');
    expect(v2.status).toBe('published');

    // v1 (original) is untouched: Ada's Maths total still 84.
    const v1Read = await inA(() =>
      publications.getPublication(tenantAId, checker(), v1.id),
    );
    const adaMathV1 = (
      v1Read.students.find((s) => s.studentId === adaId)!.subjects as any[]
    ).find((s) => s.subjectOfferingId === mathOfferingId);
    expect(Number(adaMathV1.total)).toBe(84);

    // v2 reflects the correction: 89.
    const v2Read = await inA(() =>
      publications.getPublication(tenantAId, checker(), v2.id),
    );
    const adaMathV2 = (
      v2Read.students.find((s) => s.studentId === adaId)!.subjects as any[]
    ).find((s) => s.subjectOfferingId === mathOfferingId);
    expect(Number(adaMathV2.total)).toBe(89);
  });

  it('a financial hold gates guardian visibility (audited, never silent)', async () => {
    await inA(() =>
      holds.place(tenantAId, checker(), {
        studentId: bolaId,
        reason: 'Outstanding fees',
      }),
    );
    const pubs = await inA(() =>
      publications.listPublications(tenantAId, checker(), cycleId),
    );
    const v2 = pubs.find((p) => p.version === 2)!;
    const { students } = await inA(() =>
      publications.getPublication(tenantAId, checker(), v2.id),
    );
    const ada = students.find((s) => s.studentId === adaId)!;
    const bola = students.find((s) => s.studentId === bolaId)!;
    // Staff still see BOTH rows; only the guardian-visibility flag differs.
    expect(ada.visibleToGuardian).toBe(true);
    expect(bola.visibleToGuardian).toBe(false);
  });

  it('isolates tenants via RLS and rejects anon at the HTTP boundary', async () => {
    await expect(
      inB(() => cycles.getCycle(tenantBId, maker(), cycleId)),
    ).rejects.toBeTruthy();

    const http = app.getHttpServer();
    await request(http).get('/academics/results/cycles').expect(401);
    await request(http).post('/academics/results/cycles').send({}).expect(401);
  });
});
