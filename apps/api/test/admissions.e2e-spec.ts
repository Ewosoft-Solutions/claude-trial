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
import { AdmissionRequirementsService } from '../src/admissions/services/admission-requirements.service';
import { AdmissionFeeService } from '../src/admissions/services/admission-fee.service';
import { makeSuperuserClient } from './helpers/superuser-client';

// The requirement document-upload path writes bytes through the StorageProvider.
// Force the local-disk provider for this run (hermetic — never the real R2
// bucket); restored in afterAll.
const R2_KEYS = [
  'R2_ACCOUNT_ID',
  'R2_BUCKET',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
] as const;
const savedR2: Record<string, string | undefined> = {};

const HAS_APP_RUNTIME = !!process.env.APP_RUNTIME_DATABASE_URL;
const d = HAS_APP_RUNTIME ? describe : describe.skip;

d('Admissions — pipeline + convert to student (WB3)', () => {
  let app: INestApplication;
  let owner: ReturnType<typeof makeSuperuserClient>;
  let tenantDb: TenantDbService;
  let admissions: AdmissionsService;
  let requirements: AdmissionRequirementsService;
  let fees: AdmissionFeeService;

  const stamp = Date.now();
  const A = `wb3-a-${stamp}`;
  const B = `wb3-b-${stamp}`;

  let tenantAId: string;
  let tenantBId: string;
  let campus1Id: string;
  let campus2Id: string;
  let yearId: string;
  let yearLevelId: string;
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
          applicantFirstName: 'Ada',
          applicantMiddleName: tag,
          applicantSurname: 'Okoro',
          yearLevelId,
          guardians: [
            {
              title: 'Mrs',
              firstName: 'Ebele',
              surname: 'Okoro',
              relationship: 'mother',
              email: `okoro-${tag}-${stamp}@guardian.test`,
              phoneCountryCode: '+234',
              phoneNumber: '8012345678',
              whatsappSameAsPhone: true,
              isPrimary: true,
            },
          ],
        },
        actorId,
      ),
    );
  }

  /**
   * Waive every required, unsettled fee requirement so the deposit gate (WB3-5)
   * lets a conversion through — the pipeline/scope tests aren't about fees.
   */
  async function clearRequiredFees(applicationId: string) {
    const reqs = await inA(() =>
      requirements.listForApplication(tenantAId, applicationId),
    );
    for (const r of reqs.filter(
      (x) => x.type === 'fee' && x.required && x.status === 'pending',
    )) {
      await inA(() =>
        requirements.waiveRequirement(
          tenantAId,
          applicationId,
          r.id,
          { reason: 'Not part of this test' },
          actorId,
        ),
      );
    }
  }

  beforeAll(async () => {
    // Pin the local-disk storage provider for this run (before the app boots).
    for (const k of R2_KEYS) {
      savedR2[k] = process.env[k];
      delete process.env[k];
    }

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();

    owner = makeSuperuserClient();
    tenantDb = app.get(TenantDbService);
    admissions = app.get(AdmissionsService);
    requirements = app.get(AdmissionRequirementsService);
    fees = app.get(AdmissionFeeService);

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
    yearLevelId = year.id;
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
      // Documents created by requirement uploads (cascades their versions).
      await owner.document.deleteMany({ where: inTenants });
      await owner.admissionStageEvent.deleteMany({ where: inTenants });
      await owner.admissionReview.deleteMany({ where: inTenants });
      await owner.admissionApplicationRequirement.deleteMany({
        where: inTenants,
      });
      await owner.admissionGuardian.deleteMany({ where: inTenants });
      await owner.admissionRequirement.deleteMany({ where: inTenants });
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
    for (const k of R2_KEYS) {
      if (savedR2[k] === undefined) delete process.env[k];
      else process.env[k] = savedR2[k];
    }
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

  it('composes the applying-for label and persists structured guardians', async () => {
    const created = await makeApplication('struct');
    // Composed from the year level (no stream), never re-typed.
    expect(created.applyingFor).toBe('Primary 5');
    expect(created.yearLevelId).toBe(yearLevelId);
    expect(created.guardians.length).toBe(1);
    expect(created.guardians[0]!.fullName).toBe('Mrs Ebele Okoro');
    expect(created.guardians[0]!.firstName).toBe('Ebele');
    expect(created.guardians[0]!.surname).toBe('Okoro');
    expect(created.guardians[0]!.relationship).toBe('mother');
    expect(created.guardians[0]!.isPrimary).toBe(true);
    // Legacy flat guardian fields mirror the primary for back-compat + search.
    expect(created.guardianName).toBe('Mrs Ebele Okoro');
    expect(created.guardianPhone).toContain('8012345678');
  });

  it('edits the applicant profile + REPLACES the guardian set', async () => {
    const created = await makeApplication('edit');
    const updated = await inA(() =>
      admissions.updateApplication(
        tenantAId,
        created.id,
        {
          applicantFirstName: 'Ada',
          applicantMiddleName: 'Renamed',
          applicantSurname: 'Okoro',
          dateOfBirth: '2015-03-04',
          gender: 'female',
          stateOfOrigin: 'Lagos',
          guardians: [
            {
              title: 'Mr',
              firstName: 'New',
              surname: 'Primary',
              relationship: 'father',
              phoneNumber: '8033333333',
              whatsappSameAsPhone: true,
              isPrimary: true,
            },
            {
              firstName: 'Aunt',
              surname: 'Secondary',
              relationship: 'guardian',
              phoneNumber: '8044444444',
              whatsappSameAsPhone: true,
              isPrimary: false,
            },
          ],
        },
        actorId,
      ),
    );
    expect(updated.applicantName).toBe('Ada Renamed Okoro');
    expect(updated.gender).toBe('female');
    expect(updated.stateOfOrigin).toBe('Lagos');
    // Guardian set replaced wholesale: 2 rows, exactly one primary = the first.
    expect(updated.guardians.length).toBe(2);
    expect(updated.guardians.filter((g) => g.isPrimary).length).toBe(1);
    expect(updated.guardians.find((g) => g.isPrimary)?.fullName).toBe(
      'Mr New Primary',
    );
    // Legacy flat mirror follows the NEW primary (list search stays correct).
    expect(updated.guardianName).toBe('Mr New Primary');
    expect(updated.guardianPhone).toContain('8033333333');
  });

  it('normalizes guardians: one primary, WhatsApp reuse/distinct', async () => {
    const created = await inA(() =>
      admissions.createApplication(
        tenantAId,
        {
          applicantFirstName: 'Multi',
          applicantMiddleName: 'Guardian',
          applicantSurname: 'Child',
          yearLevelId,
          guardians: [
            {
              firstName: 'Primary',
              surname: 'Parent',
              relationship: 'mother',
              phoneNumber: '8010000000',
              whatsappSameAsPhone: true,
              // Erroneously not flagged primary — the first is primary anyway.
              isPrimary: false,
            },
            {
              firstName: 'Second',
              surname: 'Parent',
              relationship: 'father',
              phoneNumber: '8020000000',
              // Distinct WhatsApp with an explicit country code.
              whatsappSameAsPhone: false,
              whatsappCountryCode: '+1',
              whatsappNumber: '2025550000',
              // Erroneously flagged primary — ignored; only the first is primary.
              isPrimary: true,
            },
          ],
        },
        actorId,
      ),
    );
    const primaries = created.guardians.filter((g) => g.isPrimary);
    expect(primaries.length).toBe(1);
    expect(primaries[0]!.fullName).toBe('Primary Parent');

    const first = created.guardians.find(
      (g) => g.fullName === 'Primary Parent',
    )!;
    expect(first.whatsappSameAsPhone).toBe(true);
    expect(first.whatsappNumber).toBeNull();

    const second = created.guardians.find(
      (g) => g.fullName === 'Second Parent',
    )!;
    expect(second.whatsappSameAsPhone).toBe(false);
    expect(second.whatsappCountryCode).toBe('+1');
    expect(second.whatsappNumber).toBe('2025550000');
  });

  it('exposes the intake structure for the cascade form', async () => {
    const structure = await inA(() => admissions.getIntakeStructure(tenantAId));
    expect(structure.stages.some((s) => s.name === 'Primary')).toBe(true);
    expect(structure.yearLevels.some((y) => y.id === yearLevelId)).toBe(true);
    expect(structure.campuses.length).toBeGreaterThanOrEqual(2);
  });

  it('attaches the default requirement checklist on create', async () => {
    const created = await makeApplication('reqs');
    const reqs = await inA(() =>
      requirements.listForApplication(tenantAId, created.id),
    );
    expect(reqs.length).toBeGreaterThan(0);
    const stages = new Set(reqs.map((r) => r.collectStage));
    // The default set staggers across application + post-offer collection.
    expect(stages.has('application')).toBe(true);
    expect(stages.has('acceptance')).toBe(true);
    expect(reqs.every((r) => r.status === 'pending')).toBe(true);
  });

  it('provides, uploads and waives requirements', async () => {
    const created = await makeApplication('fulfil');
    const reqs = await inA(() =>
      requirements.listForApplication(tenantAId, created.id),
    );
    const fee = reqs.find((r) => r.type === 'fee')!;
    const doc = reqs.find((r) => r.type === 'document')!;
    const measurement = reqs.find((r) => r.type === 'measurement')!;
    expect(fee && doc && measurement).toBeTruthy();

    // A fee cannot be satisfied via the generic value path — it settles through
    // Finance (WB3-5), so provide() rejects it (mirrors the document guard).
    await expect(
      inA(() =>
        requirements.provideRequirement(
          tenantAId,
          created.id,
          fee.id,
          { value: { paid: true } },
          actorId,
        ),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    // Upload a document (local-disk provider in tests) → provided + linked.
    const uploaded = await inA(() =>
      requirements.uploadRequirementDocument(
        tenantAId,
        created.id,
        doc.id,
        {
          mime: 'image/png',
          filename: 'passport.png',
          contentBase64: Buffer.from('fake-png-bytes').toString('base64'),
        },
        actorId,
      ),
    );
    expect(uploaded.status).toBe('provided');
    expect(uploaded.documentId).toBeTruthy();

    // Waive a measurement (reason kept).
    const waived = await inA(() =>
      requirements.waiveRequirement(
        tenantAId,
        created.id,
        measurement.id,
        { reason: 'Measured on-site' },
        actorId,
      ),
    );
    expect(waived.status).toBe('waived');
    expect(waived.waivedReason).toBe('Measured on-site');

    // A document requirement cannot be satisfied via the value path.
    await expect(
      inA(() =>
        requirements.provideRequirement(
          tenantAId,
          created.id,
          doc.id,
          { value: {} },
          actorId,
        ),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('WB3-5: bills a fee → studentless Finance invoice, settles it → provided', async () => {
    const created = await makeApplication('fee-bill');
    const reqs = await inA(() =>
      requirements.listForApplication(tenantAId, created.id),
    );
    const fee = reqs.find(
      (r) => r.type === 'fee' && r.collectStage === 'application',
    )!;
    expect(fee).toBeTruthy();

    // Bill (no explicit amount → falls back to the template's ₦5,000 prefill).
    const billed = await inA(() =>
      fees.billFee(tenantAId, created.id, fee.id, {}, actorId),
    );
    const invoiceId = (billed.requirement.value as { invoiceId?: string })
      ?.invoiceId;
    expect(invoiceId).toBeTruthy();
    expect(billed.requirement.status).toBe('pending'); // billed ≠ paid

    const invoice = await owner.feeInvoice.findFirst({
      where: { id: invoiceId!, tenantId: tenantAId },
    });
    expect(invoice?.studentId).toBeNull();
    expect(invoice?.admissionApplicationId).toBe(created.id);
    expect(invoice?.amountDue).toBe(500000);
    expect(invoice?.status).toBe('issued');

    // Idempotent: billing again returns the same invoice.
    const again = await inA(() =>
      fees.billFee(tenantAId, created.id, fee.id, {}, actorId),
    );
    expect(again.invoice.id).toBe(invoiceId);

    // Settle in full → fulfilment `provided`, invoice `paid`, payment studentless.
    const settled = await inA(() =>
      fees.settleFee(
        tenantAId,
        created.id,
        fee.id,
        { amount: 500000, method: 'transfer', paidAt: '2026-08-14' },
        actorId,
      ),
    );
    expect(settled.requirement.status).toBe('provided');

    const paidInvoice = await owner.feeInvoice.findFirst({
      where: { id: invoiceId!, tenantId: tenantAId },
    });
    expect(paidInvoice?.status).toBe('paid');
    expect(paidInvoice?.amountPaid).toBe(500000);
    const payment = await owner.payment.findFirst({
      where: { tenantId: tenantAId, invoiceId: invoiceId! },
    });
    expect(payment?.studentId).toBeNull();
    expect(payment?.amount).toBe(500000);
  });

  it('WB3-5: an unpaid required fee blocks conversion; settling + waiving unblocks and re-keys to the student', async () => {
    const created = await makeApplication('fee-gate');
    await inA(() =>
      admissions.makeOffer(
        tenantAId,
        created.id,
        { targetClassSectionId: section1Id, academicYearId: yearId },
        actorId,
      ),
    );
    await inA(() =>
      admissions.recordAcceptance(tenantAId, created.id, actorId),
    );

    const reqs = await inA(() =>
      requirements.listForApplication(tenantAId, created.id),
    );
    const appFee = reqs.find(
      (r) => r.type === 'fee' && r.collectStage === 'application',
    )!;
    const accFee = reqs.find(
      (r) => r.type === 'fee' && r.collectStage === 'acceptance',
    )!;

    // Gate: required fees are still `pending` → conversion is refused.
    await expect(
      inA(() =>
        admissions.convertToStudent(tenantAId, unscoped(), created.id, {
          classSectionId: section1Id,
          academicYearId: yearId,
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    // Settle the application fee (a real invoice) + waive the acceptance fee.
    await inA(() =>
      fees.billFee(tenantAId, created.id, appFee.id, {}, actorId),
    );
    const settled = await inA(() =>
      fees.settleFee(
        tenantAId,
        created.id,
        appFee.id,
        { amount: 500000, method: 'cash', paidAt: '2026-08-14' },
        actorId,
      ),
    );
    const invoiceId = (settled.requirement.value as { invoiceId?: string })
      .invoiceId!;
    await inA(() =>
      requirements.waiveRequirement(
        tenantAId,
        created.id,
        accFee.id,
        { reason: 'Scholarship' },
        actorId,
      ),
    );

    // Now conversion succeeds.
    const result = await inA(() =>
      admissions.convertToStudent(tenantAId, unscoped(), created.id, {
        classSectionId: section1Id,
        academicYearId: yearId,
      }),
    );
    expect(result.studentId).toBeTruthy();

    // Re-key: the admission invoice + payment now carry the new student id, and
    // the invoice stays traceable back to the application.
    const invoice = await owner.feeInvoice.findFirst({
      where: { id: invoiceId, tenantId: tenantAId },
    });
    expect(invoice?.studentId).toBe(result.studentId);
    expect(invoice?.admissionApplicationId).toBe(created.id);
    const payment = await owner.payment.findFirst({
      where: { tenantId: tenantAId, invoiceId },
    });
    expect(payment?.studentId).toBe(result.studentId);
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
    await clearRequiredFees(appId); // deposit gate: waive fees for this flow

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
    await clearRequiredFees(id); // deposit gate fires before the scope check

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
