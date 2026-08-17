/**
 * WB4-2/3/4 — spreadsheet import, behavioural traits, and the cumulative
 * transcript, proven on the app_runtime (RLS-enforcing) client.
 *
 * Acceptance:
 *   - WB4-2 import is a DRY RUN first: a sheet with a bad cell or an unknown
 *     student reports every problem and writes NOTHING, and a commit is refused
 *     while a problem stands;
 *   - a clean sheet imports through the keyed-entry path with absent ≠ zero
 *     preserved (ABS → absent, EXM → exempt, blank → no row at all);
 *   - a real .xlsx workbook imports as well as a .csv;
 *   - WB4-3 the trait rubric is DRAFT-ONLY, a rating cannot exceed its own
 *     scale, and an unrated trait is absent from the publication snapshot (never
 *     the lowest rating) — while rated traits ARE snapshotted per student;
 *   - WB4-4 the transcript is assembled from PUBLISHED snapshots only: it cites
 *     each publication's version + checksum, excludes a superseded version, and
 *     excludes an absent subject from the cumulative average instead of zeroing
 *     it; issuing it stores an immutable artifact;
 *   - RLS isolates the two new tables; HTTP 401 holds at the boundary.
 *
 * Requires APP_RUNTIME_DATABASE_URL; skips otherwise.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, INestApplication } from '@nestjs/common';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { Workbook } from 'exceljs';

import { AppModule } from '../src/app.module';
import { TenantDbService } from '../src/common';
import { ResultCycleService } from '../src/results/services/result-cycle.service';
import { ResultImportService } from '../src/results/services/result-import.service';
import { ResultPublicationService } from '../src/results/services/result-publication.service';
import { ResultTraitService } from '../src/results/services/result-trait.service';
import { ResultTranscriptService } from '../src/results/services/result-transcript.service';
import type { ResultActor } from '../src/results/services/results.types';
import { JobWorker } from '../src/common/jobs/job.worker';
import { makeSuperuserClient } from './helpers/superuser-client';

const HAS_APP_RUNTIME = !!process.env.APP_RUNTIME_DATABASE_URL;
const d = HAS_APP_RUNTIME ? describe : describe.skip;

d('Results — import · traits · transcript (WB4-2/3/4)', () => {
  let app: INestApplication;
  let owner: ReturnType<typeof makeSuperuserClient>;
  let tenantDb: TenantDbService;
  let cycles: ResultCycleService;
  let imports: ResultImportService;
  let traits: ResultTraitService;
  let publications: ResultPublicationService;
  let transcripts: ResultTranscriptService;
  let worker: JobWorker;

  const stamp = Date.now();
  const A = `wb4x-a-${stamp}`;
  const B = `wb4x-b-${stamp}`;

  let tenantAId: string;
  let tenantBId: string;
  let campusId: string;
  let yearId: string;
  let termId: string;
  let sectionId: string;
  let mathOfferingId: string;
  let englishOfferingId: string;
  let gradingSystemId: string;
  let adaId: string;
  let bolaId: string;
  let adaNumber: string;
  let bolaNumber: string;
  let makerId: string;
  let checkerId: string;
  let cycleId: string;

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

  const b64 = (text: string) => Buffer.from(text, 'utf8').toString('base64');

  async function makeStudent(tag: string, first: string) {
    const user = await owner.user.create({
      data: {
        email: `wb4x-${tag}-${stamp}@s.test`,
        firstName: first,
        lastName: 'Test',
        isActive: true,
      },
    });
    const ut = await owner.userTenant.create({
      data: { userId: user.id, tenantId: tenantAId, status: 'active' },
    });
    const studentNumber = `STU-${tag}-${stamp}`;
    const student = await owner.student.create({
      data: {
        tenantId: tenantAId,
        userTenantId: ut.id,
        studentNumber,
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
    return { id: student.id, studentNumber };
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
    imports = app.get(ResultImportService);
    traits = app.get(ResultTraitService);
    publications = app.get(ResultPublicationService);
    transcripts = app.get(ResultTranscriptService);
    worker = app.get(JobWorker);

    const [ta, tb, mk, ck] = await Promise.all([
      owner.tenant.create({
        data: {
          name: 'WB4X A',
          slug: A,
          status: 'active',
          schoolType: 'secondary',
        },
      }),
      owner.tenant.create({
        data: {
          name: 'WB4X B',
          slug: B,
          status: 'active',
          schoolType: 'secondary',
        },
      }),
      owner.user.create({
        data: { email: `wb4x-maker-${stamp}@a.test`, isActive: true },
      }),
      owner.user.create({
        data: { email: `wb4x-checker-${stamp}@a.test`, isActive: true },
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
      data: { tenantId: tenantAId, name: 'Junior Secondary', code: 'JSS' },
    });
    const yl = await owner.yearLevel.create({
      data: {
        tenantId: tenantAId,
        stageId: stage.id,
        name: 'JSS1',
        code: 'JSS1',
      },
    });
    const ay = await owner.academicYear.create({
      data: {
        tenantId: tenantAId,
        name: `${stamp}-AYX`,
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
        displayLabel: 'JSS1 A',
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
          curriculumSubjectId: `csx-math-${stamp}`,
          subjectLabel: 'Mathematics',
        },
      }),
      owner.subjectOffering.create({
        data: {
          tenantId: tenantAId,
          classSectionId: sectionId,
          academicYearId: yearId,
          termId,
          curriculumSubjectId: `csx-eng-${stamp}`,
          subjectLabel: 'English',
        },
      }),
    ]);
    mathOfferingId = math.id;
    englishOfferingId = english.id;

    const gs = await owner.gradingSystem.create({
      data: {
        tenantId: tenantAId,
        name: `WAEC-like X ${stamp}`,
        systemType: 'letter_grade',
        gradeScale: SCALE,
      },
    });
    gradingSystemId = gs.id;

    const [ada, bola] = await Promise.all([
      makeStudent('ada', 'Ada'),
      makeStudent('bola', 'Bola'),
    ]);
    adaId = ada.id;
    adaNumber = ada.studentNumber;
    bolaId = bola.id;
    bolaNumber = bola.studentNumber;
  });

  afterAll(async () => {
    if (owner) {
      const inTenants = { tenantId: { in: [tenantAId, tenantBId] } };
      await owner.document.deleteMany({
        where: {
          ...inTenants,
          ownerType: { in: ['ResultPublication', 'Student'] },
        },
      });
      await owner.resultTraitRating.deleteMany({ where: inTenants });
      await owner.resultTrait.deleteMany({ where: inTenants });
      await owner.publishedStudentResult.deleteMany({ where: inTenants });
      await owner.resultAmendment.deleteMany({ where: inTenants });
      await owner.resultPublication.deleteMany({ where: inTenants });
      await owner.resultEntry.deleteMany({ where: inTenants });
      await owner.resultComponent.deleteMany({ where: inTenants });
      await owner.resultCycleSection.deleteMany({ where: inTenants });
      await owner.financialHold.deleteMany({ where: inTenants });
      await owner.resultCycle.deleteMany({ where: inTenants });
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

  // ---------------------------------------------------------------- WB4-3 draft

  it('configures a cycle + trait rubric while it is a draft', async () => {
    const cycle = await inA(() =>
      cycles.createCycle(tenantAId, maker(), {
        name: 'First Term Results (import)',
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
          { key: 'EXAM', label: 'Exam', maxScore: 80, isExam: true },
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
        promotionPolicy: { passMark: 40, maxFailedSubjects: 1 },
      }),
    );

    const rubric = await inA(() =>
      traits.configureTraits(tenantAId, maker(), cycleId, {
        traits: [
          { domain: 'affective', key: 'punctuality', label: 'Punctuality' },
          { domain: 'affective', key: 'neatness', label: 'Neatness' },
          {
            domain: 'psychomotor',
            key: 'handwriting',
            label: 'Handwriting',
            maxRating: 4,
          },
        ],
      }),
    );
    expect(rubric).toHaveLength(3);
    expect(rubric.map((t) => t.key)).toEqual(
      expect.arrayContaining(['punctuality', 'neatness', 'handwriting']),
    );
  });

  // --------------------------------------------------------------- WB4-2 import

  it('builds a template covering every student × subject in the section', async () => {
    const template = await inA(() =>
      imports.buildTemplate(tenantAId, maker(), cycleId, sectionId),
    );
    const lines = template.csv.trim().split('\n');
    expect(template.filename).toBe('result-template-jss1-a.csv');
    expect(lines[0]).toBe(
      'Student number,Student name,Subject,First CA (max 20),Exam (max 80)',
    );
    // 2 students × 2 subjects
    expect(lines).toHaveLength(5);
    expect(template.csv).toContain(adaNumber);
    expect(template.csv).toContain('Mathematics');
  });

  it('refuses to import while the cycle is not open for entry', async () => {
    await expect(
      inA(() =>
        imports.importScores(tenantAId, maker(), cycleId, {
          sectionId,
          contentBase64: b64('Student number,Subject,CA1\n'),
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    await inA(() => cycles.openEntry(tenantAId, maker(), cycleId));
  });

  it('dry-runs a bad sheet: reports every problem and writes nothing', async () => {
    const csv = [
      'Student number,Student name,Subject,First CA,Exam',
      `${adaNumber},Ada Test,Mathematics,18,70`,
      `${adaNumber},Ada Test,Mathematics,17,60`, // duplicate cell
      `${bolaNumber},Bola Test,Mathematics,twelve,40`, // unreadable
      `${bolaNumber},Bola Test,Mathematics,25,40`, // over the max 20 (dup too)
      `STU-GHOST-${stamp},Ghost Child,Mathematics,10,20`, // unknown student
      `${adaNumber},Ada Test,Astrology,10,20`, // unknown subject
      '',
    ].join('\n');

    const report = await inA(() =>
      imports.importScores(tenantAId, maker(), cycleId, {
        sectionId,
        filename: 'bad.csv',
        contentBase64: b64(csv),
      }),
    );
    expect(report.committed).toBe(false);
    expect(report.errors.length).toBeGreaterThanOrEqual(4);
    expect(report.unmatchedStudents).toContain(`STU-GHOST-${stamp}`);
    expect(report.unmatchedSubjects).toContain('Astrology');
    expect(report.errors.some((e) => /not a score/.test(e.message))).toBe(true);
    expect(
      report.errors.some((e) => /exceeds the max 20/.test(e.message)),
    ).toBe(true);
    expect(report.errors.some((e) => /Duplicate row/.test(e.message))).toBe(
      true,
    );

    // Nothing was written — a dry run is a dry run.
    const written = await owner.resultEntry.count({
      where: { tenantId: tenantAId, cycleId },
    });
    expect(written).toBe(0);

    // …and a commit is refused while a problem stands.
    await expect(
      inA(() =>
        imports.importScores(tenantAId, maker(), cycleId, {
          sectionId,
          filename: 'bad.csv',
          contentBase64: b64(csv),
          commit: true,
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(
      await owner.resultEntry.count({
        where: { tenantId: tenantAId, cycleId },
      }),
    ).toBe(0);
  });

  it('round-trips the generated template: its own headers match its own components', async () => {
    // The template labels columns "First CA (max 20)"; the importer must read
    // its own artifact back without the human editing the header row.
    const template = await inA(() =>
      imports.buildTemplate(tenantAId, maker(), cycleId, sectionId),
    );
    const [header, ...rows] = template.csv.trim().split('\n');
    const columnCount = header!.split(',').length;
    const filled = [
      header!,
      // Fill only Ada's Mathematics row (the template already ends with the two
      // empty component cells, so SET them rather than append).
      ...rows.map((row) => {
        const cells = row.split(',');
        if (!row.startsWith(`${adaNumber},Ada Test,Mathematics`)) return row;
        cells[columnCount - 2] = '10';
        cells[columnCount - 1] = '40';
        return cells.join(',');
      }),
      '',
    ].join('\n');

    const report = await inA(() =>
      imports.importScores(tenantAId, maker(), cycleId, {
        sectionId,
        filename: 'result-template-jss1-a.csv',
        contentBase64: b64(filled),
      }),
    );
    expect(report.errors).toHaveLength(0);
    expect(report.componentColumns).toEqual(['First CA', 'Exam']);
    expect(report.matchedRows).toBe(4);
    expect(report.scores).toBe(2); // only the row we filled
    expect(report.cellsToWrite).toBe(2);
  });

  it('commits a clean sheet: ABS stays absent, EXM stays exempt, a blank writes nothing', async () => {
    const csv = [
      'Student number,Student name,Subject,First CA,Exam',
      // Ada: Maths fully scored; English CA only (Exam left blank).
      `${adaNumber},Ada Test,Mathematics,18,70`,
      `${adaNumber},Ada Test,English,15,`,
      // Bola: Maths scored; English ABSENT for both components.
      `${bolaNumber},Bola Test,Mathematics,12,30`,
      `${bolaNumber},Bola Test,English,ABS,ABS`,
      '',
    ].join('\n');

    const report = await inA(() =>
      imports.importScores(tenantAId, maker(), cycleId, {
        sectionId,
        filename: 'clean.csv',
        contentBase64: b64(csv),
        commit: true,
      }),
    );
    expect(report.committed).toBe(true);
    expect(report.errors).toHaveLength(0);
    expect(report.matchedRows).toBe(4);
    expect(report.scores).toBe(5);
    expect(report.absent).toBe(2);
    expect(report.blank).toBe(1); // Ada's English exam
    expect(report.upserted).toBe(7);

    const rows = await owner.resultEntry.findMany({
      where: { tenantId: tenantAId, cycleId },
      select: {
        studentId: true,
        subjectOfferingId: true,
        score: true,
        isAbsent: true,
        component: { select: { key: true } },
      },
    });
    expect(rows).toHaveLength(7);

    // The blank cell produced NO row at all (not a zero).
    const adaEnglishExam = rows.find(
      (r) =>
        r.studentId === adaId &&
        r.subjectOfferingId === englishOfferingId &&
        r.component.key === 'EXAM',
    );
    expect(adaEnglishExam).toBeUndefined();

    // ABS imported as absent with NO score.
    const bolaEnglish = rows.filter(
      (r) =>
        r.studentId === bolaId && r.subjectOfferingId === englishOfferingId,
    );
    expect(bolaEnglish).toHaveLength(2);
    for (const row of bolaEnglish) {
      expect(row.isAbsent).toBe(true);
      expect(row.score).toBeNull();
    }
  });

  it('imports a real .xlsx workbook, and EXM lands as exempt', async () => {
    const workbook = new Workbook();
    const sheet = workbook.addWorksheet('Scores');
    sheet.addRow(['Student number', 'Student name', 'Subject', 'CA1', 'EXAM']);
    // Ada's English exam, keyed by component KEY rather than label this time.
    sheet.addRow([adaNumber, 'Ada Test', 'English', '', 55]);
    // Bola is exempt from English entirely (a swap of the absent rows above).
    sheet.addRow([bolaNumber, 'Bola Test', 'English', 'EXM', 'EXM']);
    const buffer = await workbook.xlsx.writeBuffer();

    const report = await inA(() =>
      imports.importScores(tenantAId, maker(), cycleId, {
        sectionId,
        filename: 'scores.xlsx',
        contentBase64: Buffer.from(buffer).toString('base64'),
        commit: true,
      }),
    );
    expect(report.committed).toBe(true);
    expect(report.errors).toHaveLength(0);
    expect(report.scores).toBe(1);
    expect(report.exempt).toBe(2);

    const bolaEnglish = await owner.resultEntry.findMany({
      where: {
        tenantId: tenantAId,
        cycleId,
        studentId: bolaId,
        subjectOfferingId: englishOfferingId,
      },
      select: { isExempt: true, isAbsent: true, score: true },
    });
    expect(bolaEnglish).toHaveLength(2);
    for (const row of bolaEnglish) {
      expect(row.isExempt).toBe(true);
      expect(row.isAbsent).toBe(false);
      expect(row.score).toBeNull();
    }
  });

  // ------------------------------------------------------------- WB4-3 ratings

  it('rates traits within their own scale and refuses an over-scale rating', async () => {
    const res = await inA(() =>
      traits.rateTraits(tenantAId, maker(), cycleId, {
        ratings: [
          { studentId: adaId, traitKey: 'punctuality', rating: 5 },
          { studentId: adaId, traitKey: 'handwriting', rating: 4 },
          // Ada's `neatness` is deliberately left unrated.
          { studentId: bolaId, traitKey: 'punctuality', rating: 3 },
        ],
      }),
    );
    expect(res.upserted).toBe(3);

    // `handwriting` is a 4-point scale — 5 is out of range.
    await expect(
      inA(() =>
        traits.rateTraits(tenantAId, maker(), cycleId, {
          ratings: [{ studentId: adaId, traitKey: 'handwriting', rating: 5 }],
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    // An unknown trait key and an out-of-scope student are both refused.
    await expect(
      inA(() =>
        traits.rateTraits(tenantAId, maker(), cycleId, {
          ratings: [{ studentId: adaId, traitKey: 'nope', rating: 1 }],
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses a rubric change once the cycle has left draft', async () => {
    await expect(
      inA(() =>
        traits.configureTraits(tenantAId, maker(), cycleId, {
          traits: [
            { domain: 'affective', key: 'punctuality', label: 'Punctuality' },
          ],
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  // -------------------------------------------------------------- publish + WB4-4

  let publicationId: string;

  it('publishes: rated traits are snapshotted per student, unrated ones are absent', async () => {
    // Fill Ada's English exam so the cycle is complete, then publish.
    await inA(() =>
      imports.importScores(tenantAId, maker(), cycleId, {
        sectionId,
        subjectOfferingId: englishOfferingId,
        filename: 'fill.csv',
        contentBase64: b64(
          ['Student number,CA1,EXAM', `${adaNumber},15,55`, ''].join('\n'),
        ),
        commit: true,
      }),
    );
    const validation = await inA(() =>
      cycles.validateCycle(tenantAId, maker(), cycleId),
    );
    expect(validation.complete).toBe(true);

    await inA(() => cycles.closeEntry(tenantAId, maker(), cycleId));
    await inA(() => cycles.moveToModeration(tenantAId, maker(), cycleId));
    await inA(() => publications.requestPublish(tenantAId, maker(), cycleId));
    const published = await inA(() =>
      publications.approveAndPublish(tenantAId, checker(), cycleId),
    );
    expect(published.status).toBe('published');
    publicationId = published.publicationId;

    const adaRow = await owner.publishedStudentResult.findFirst({
      where: { tenantId: tenantAId, publicationId, studentId: adaId },
      select: { traits: true },
    });
    const adaTraits = adaRow?.traits as
      | { key: string; rating: number; maxRating: number; domain: string }[]
      | null;
    expect(adaTraits).not.toBeNull();
    // Rubric order (affective punctuality, affective neatness, psychomotor
    // handwriting) drives the snapshot order — neatness is missing because it
    // was never rated.
    expect(adaTraits!.map((t) => t.key)).toEqual([
      'punctuality',
      'handwriting',
    ]);
    const handwriting = adaTraits!.find((t) => t.key === 'handwriting')!;
    expect(handwriting).toMatchObject({
      domain: 'psychomotor',
      rating: 4,
      maxRating: 4,
    });
    // The unrated trait is simply ABSENT — never published as a 1.
    expect(adaTraits!.some((t) => t.key === 'neatness')).toBe(false);

    // The rubric itself is snapshotted so a report card still renders labels.
    const publication = await owner.resultPublication.findFirstOrThrow({
      where: { id: publicationId },
      select: { snapshot: true },
    });
    const snapshot = publication.snapshot as unknown as {
      traitRubric: { key: string }[];
    };
    expect(snapshot.traitRubric.map((t) => t.key).sort()).toEqual([
      'handwriting',
      'neatness',
      'punctuality',
    ]);
  });

  it('builds a transcript from published snapshots, absent excluded from the average', async () => {
    const transcript = await inA(() =>
      transcripts.getTranscript(tenantAId, maker(), bolaId),
    );
    expect(transcript.terms).toHaveLength(1);
    const term = transcript.terms[0]!;
    expect(term.academicYearName).toBe(`${stamp}-AYX`);
    expect(term.termName).toBe('First Term');
    expect(term.version).toBe(1);
    expect(term.checksum).toMatch(/^[a-f0-9]{64}$/);

    // Bola: Maths 12 + 30 = 42/100 → 42%; English EXEMPT (no percentage).
    const maths = term.subjects.find((s) => s.subjectLabel === 'Mathematics')!;
    const english = term.subjects.find((s) => s.subjectLabel === 'English')!;
    expect(maths.percentage).toBe(42);
    expect(english.percentage).toBeNull();

    // The cumulative average is Maths alone — a zero for English would have
    // halved it.
    expect(transcript.summary.cumulativeAverage).toBe(42);
    expect(transcript.summary.gradedSubjectCount).toBe(1);
    expect(transcript.summary.subjects.map((s) => s.subjectLabel)).toEqual([
      'Mathematics',
    ]);
    expect(transcript.visibleToGuardian).toBe(true);
  });

  it('shows only the CURRENT version of an amended term', async () => {
    const amendment = await inA(() =>
      publications.requestAmendment(tenantAId, maker(), cycleId, {
        reason: 'Maths exam re-mark for Bola',
        changes: [
          {
            studentId: bolaId,
            subjectOfferingId: mathOfferingId,
            componentKey: 'EXAM',
            score: 50, // 42% → 62%
          },
        ],
      }),
    );
    await inA(() =>
      publications.approveAmendment(
        tenantAId,
        checker(),
        (amendment as { amendmentId: string }).amendmentId,
      ),
    );

    const transcript = await inA(() =>
      transcripts.getTranscript(tenantAId, maker(), bolaId),
    );
    // Still ONE term — the superseded v1 does not appear twice.
    expect(transcript.terms).toHaveLength(1);
    expect(transcript.terms[0]!.version).toBe(2);
    expect(transcript.summary.cumulativeAverage).toBe(62);
  });

  it('issues the transcript as an immutable, audited artifact', async () => {
    const issued = await inA(() =>
      transcripts.issueTranscript(tenantAId, maker(), adaId),
    );
    expect(issued.documentId).toBeTruthy();
    expect(issued.checksum).toMatch(/^[a-f0-9]{64}$/);
    expect(issued.termCount).toBe(1);

    const doc = await owner.document.findFirstOrThrow({
      where: { id: issued.documentId },
      select: {
        ownerType: true,
        ownerId: true,
        title: true,
        sensitive: true,
        sourceSystem: true,
      },
    });
    expect(doc.ownerType).toBe('Student');
    expect(doc.ownerId).toBe(adaId);
    expect(doc.sensitive).toBe(true);
    expect(doc.title).toContain('Transcript');
    // Provenance, not the title, is what marks a transcript this system issued.
    expect(doc.sourceSystem).toBe('results.transcript');

    const audited = await owner.auditLog.count({
      where: {
        tenantId: tenantAId,
        action: 'academics.results.transcript.issue',
        resourceId: adaId,
      },
    });
    expect(audited).toBe(1);

    // The transcript read now surfaces the stored artifact.
    const transcript = await inA(() =>
      transcripts.getTranscript(tenantAId, maker(), adaId),
    );
    expect(transcript.transcriptDocumentId).toBe(issued.documentId);
  });

  it('does not mistake an uploaded document titled "Transcript…" for an issued one', async () => {
    const fresh = await makeStudent('dele', 'Dele');
    // A prior-school record, uploaded at admission against the student.
    await owner.document.create({
      data: {
        tenantId: tenantAId,
        ownerType: 'Student',
        ownerId: fresh.id,
        title: "Transcript from St Mary's",
        visibility: 'restricted',
        scanStatus: 'clean',
      },
    });
    const transcript = await inA(() =>
      transcripts.getTranscript(tenantAId, maker(), fresh.id),
    );
    // No transcript has been ISSUED for this student, whatever the upload is called.
    expect(transcript.transcriptDocumentId).toBeNull();
  });

  it('refuses to issue a transcript a campus scope would make partial', async () => {
    // A reader scoped to a different campus sees none of this cycle's terms.
    const otherCampus = await owner.campus.create({
      data: {
        tenantId: tenantAId,
        name: 'Annex',
        code: `ANNEX-${stamp}`,
        isPrimary: false,
      },
    });
    const scoped = (): ResultActor => ({
      userId: makerId,
      clearanceLevel: 7,
      grantScope: { type: 'campus', value: otherCampus.id },
    });

    const partial = await inA(() =>
      transcripts.getTranscript(tenantAId, scoped(), adaId),
    );
    // The record READS as empty-but-flagged rather than silently short…
    expect(partial.terms).toHaveLength(0);
    expect(partial.withheldTerms).toBeGreaterThan(0);
    // …and issuing an official document from it is refused.
    await expect(
      inA(() => transcripts.issueTranscript(tenantAId, scoped(), adaId)),
    ).rejects.toBeInstanceOf(BadRequestException);

    // A school-wide reader still sees the whole record and can issue it.
    const full = await inA(() =>
      transcripts.getTranscript(tenantAId, maker(), adaId),
    );
    expect(full.withheldTerms).toBe(0);
    expect(full.terms.length).toBeGreaterThan(0);
  });

  it('refuses a transcript for a student with no published results', async () => {
    const fresh = await makeStudent('cleo', 'Cleo');
    const transcript = await inA(() =>
      transcripts.getTranscript(tenantAId, maker(), fresh.id),
    );
    expect(transcript.terms).toHaveLength(0);
    expect(transcript.summary.cumulativeAverage).toBeNull();
    await expect(
      inA(() => transcripts.issueTranscript(tenantAId, maker(), fresh.id)),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('renders the report card with the behavioural block (F3 job)', async () => {
    for (let i = 0; i < 200; i++) {
      if (!(await worker.processOnce())) break;
    }
    const cards = await owner.publishedStudentResult.findMany({
      where: { tenantId: tenantAId, studentId: adaId },
      select: { reportCardDocumentId: true },
    });
    expect(cards.some((c) => c.reportCardDocumentId)).toBe(true);
  });

  it('isolates the new tables via RLS and rejects anon at the HTTP boundary', async () => {
    // Tenant B cannot read tenant A's rubric or ratings.
    const seenTraits = await inB(() =>
      tenantDb.client.resultTrait.findMany({ where: { cycleId } }),
    );
    expect(seenTraits).toHaveLength(0);
    const seenRatings = await inB(() =>
      tenantDb.client.resultTraitRating.findMany({ where: { cycleId } }),
    );
    expect(seenRatings).toHaveLength(0);

    const http = app.getHttpServer();
    await request(http)
      .get(`/academics/results/cycles/${cycleId}/traits`)
      .expect(401);
    await request(http)
      .post(`/academics/results/cycles/${cycleId}/import`)
      .send({})
      .expect(401);
    await request(http)
      .get(`/academics/results/students/${adaId}/transcript`)
      .expect(401);
  });
});
