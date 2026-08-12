/**
 * WB3-3 + WB3-4 · versioned application form + typed responses, and interview /
 * exam scheduling with an auto-marked admission quiz — behavioural proof on the
 * app_runtime (RLS-enforcing) client.
 *
 * Acceptance:
 *   - a form is versioned: publishing a new version supersedes (archives) the
 *     prior published one; a published version is immutable.
 *   - responses are validated by field type; a bad answer is refused; the
 *     response snapshots the version it answered.
 *   - an interview records a structured outcome; an exam's inline quiz is
 *     auto-marked server-side (objective) and flags essays for manual grading.
 *   - RLS isolates the new tables across tenants.
 *
 * Requires APP_RUNTIME_DATABASE_URL; skips otherwise.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, INestApplication } from '@nestjs/common';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

import { AppModule } from '../src/app.module';
import { TenantDbService } from '../src/common';
import { AdmissionsService } from '../src/admissions/services/admissions.service';
import { AdmissionFormsService } from '../src/admissions/services/admission-forms.service';
import { AdmissionInterviewsService } from '../src/admissions/services/admission-interviews.service';
import { makeSuperuserClient } from './helpers/superuser-client';

const HAS_APP_RUNTIME = !!process.env.APP_RUNTIME_DATABASE_URL;
const d = HAS_APP_RUNTIME ? describe : describe.skip;

// Pin the local-disk storage provider (a `file` form field uploads through F4).
const R2_KEYS = [
  'R2_ACCOUNT_ID',
  'R2_BUCKET',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
] as const;
const savedR2: Record<string, string | undefined> = {};

d('Admissions — forms + interviews/quiz (WB3-3 + WB3-4)', () => {
  let app: INestApplication;
  let owner: ReturnType<typeof makeSuperuserClient>;
  let tenantDb: TenantDbService;
  let forms: AdmissionFormsService;
  let interviews: AdmissionInterviewsService;
  let admissions: AdmissionsService;

  const stamp = Date.now();
  const A = `wb3fi-a-${stamp}`;
  const B = `wb3fi-b-${stamp}`;

  let tenantAId: string;
  let tenantBId: string;
  let actorId: string;
  let yearLevelId: string;
  let appId: string;

  const inA = <T>(fn: () => Promise<T>) =>
    tenantDb.runScoped(tenantAId, actorId, fn);
  const inB = <T>(fn: () => Promise<T>) =>
    tenantDb.runScoped(tenantBId, actorId, fn);

  beforeAll(async () => {
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
    forms = app.get(AdmissionFormsService);
    interviews = app.get(AdmissionInterviewsService);
    admissions = app.get(AdmissionsService);

    const [ta, tb, actor] = await Promise.all([
      owner.tenant.create({
        data: {
          name: 'WB3FI A',
          slug: A,
          status: 'active',
          schoolType: 'secondary',
        },
      }),
      owner.tenant.create({
        data: {
          name: 'WB3FI B',
          slug: B,
          status: 'active',
          schoolType: 'secondary',
        },
      }),
      owner.user.create({
        data: { email: `wb3fi-actor-${stamp}@a.test`, isActive: true },
      }),
    ]);
    tenantAId = ta.id;
    tenantBId = tb.id;
    actorId = actor.id;

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

    const application = await inA(() =>
      admissions.createApplication(
        tenantAId,
        {
          applicantName: 'Ada Forms Okoro',
          yearLevelId,
          guardians: [
            {
              fullName: 'Mrs Okoro',
              relationship: 'mother',
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
    appId = application.id;
  });

  afterAll(async () => {
    if (owner) {
      const inTenants = { tenantId: { in: [tenantAId, tenantBId] } };
      await owner.admissionFormResponse.deleteMany({ where: inTenants });
      await owner.admissionFormVersion.deleteMany({ where: inTenants });
      await owner.admissionInterview.deleteMany({ where: inTenants });
      await owner.admissionStageEvent.deleteMany({ where: inTenants });
      await owner.admissionReview.deleteMany({ where: inTenants });
      await owner.admissionApplicationRequirement.deleteMany({
        where: inTenants,
      });
      await owner.admissionGuardian.deleteMany({ where: inTenants });
      await owner.admissionRequirement.deleteMany({ where: inTenants });
      await owner.document.deleteMany({ where: inTenants });
      await owner.admissionApplication.deleteMany({ where: inTenants });
      await owner.yearLevel.deleteMany({ where: inTenants });
      await owner.stage.deleteMany({ where: inTenants });
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

  // ---- WB3-3 versioned form ----

  it('versions the form: publishing v2 supersedes (archives) v1', async () => {
    const v1 = await inA(() =>
      forms.createDraft(tenantAId, actorId, {
        title: 'Intake 2026',
        fields: [
          {
            key: 'previous_school',
            label: 'Previous school',
            type: 'text',
            required: true,
          },
          { key: 'boarding', label: 'Boarding?', type: 'boolean' },
        ],
      }),
    );
    expect(v1.version).toBe(1);
    await inA(() => forms.publishVersion(tenantAId, actorId, v1.id));

    let current = await inA(() => forms.getCurrentForm(tenantAId));
    expect(current?.version).toBe(1);
    expect(current?.status).toBe('published');

    // A published version is immutable.
    await expect(
      inA(() =>
        forms.updateDraft(tenantAId, actorId, v1.id, { title: 'Nope' }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    const v2 = await inA(() =>
      forms.createDraft(tenantAId, actorId, {
        title: 'Intake 2026 (rev)',
        fields: [
          {
            key: 'previous_school',
            label: 'Previous school',
            type: 'text',
            required: true,
          },
          {
            key: 'stream_pref',
            label: 'Stream preference',
            type: 'select',
            options: ['Science', 'Arts'],
          },
        ],
      }),
    );
    expect(v2.version).toBe(2);
    await inA(() => forms.publishVersion(tenantAId, actorId, v2.id));

    current = await inA(() => forms.getCurrentForm(tenantAId));
    expect(current?.version).toBe(2);
    const reloadedV1 = await inA(() => forms.getVersion(tenantAId, v1.id));
    expect(reloadedV1.status).toBe('archived');
  });

  it('validates typed responses and snapshots the answered version', async () => {
    // Missing a required field is refused.
    await expect(
      inA(() =>
        forms.submitResponse(tenantAId, appId, actorId, {
          answers: { stream_pref: 'Science' },
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    // A select value outside the options is refused.
    await expect(
      inA(() =>
        forms.submitResponse(tenantAId, appId, actorId, {
          answers: { previous_school: 'Sunrise', stream_pref: 'Commerce' },
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    // An unknown field key is refused.
    await expect(
      inA(() =>
        forms.submitResponse(tenantAId, appId, actorId, {
          answers: { previous_school: 'Sunrise', nickname: 'Ada' },
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    const res = await inA(() =>
      forms.submitResponse(tenantAId, appId, actorId, {
        answers: { previous_school: 'Sunrise Primary', stream_pref: 'Science' },
      }),
    );
    expect(res.formVersion).toBe(2);
    expect((res.answers as Record<string, unknown>).previous_school).toBe(
      'Sunrise Primary',
    );

    // Re-submitting updates in place (one response per version).
    const res2 = await inA(() =>
      forms.submitResponse(tenantAId, appId, actorId, {
        answers: { previous_school: 'Dawn Academy', stream_pref: 'Arts' },
      }),
    );
    expect(res2.id).toBe(res.id);
    expect((res2.answers as Record<string, unknown>).stream_pref).toBe('Arts');
  });

  it('captures a `file` field: uploads through F4 + stores a document ref', async () => {
    const v3 = await inA(() =>
      forms.createDraft(tenantAId, actorId, {
        title: 'Intake 2026 (with upload)',
        fields: [
          {
            key: 'previous_school',
            label: 'Previous school',
            type: 'text',
            required: true,
          },
          {
            key: 'report_card',
            label: 'Last report card',
            type: 'file',
            required: true,
          },
        ],
      }),
    );
    await inA(() => forms.publishVersion(tenantAId, actorId, v3.id));

    // A missing required file is refused.
    await expect(
      inA(() =>
        forms.submitResponse(tenantAId, appId, actorId, {
          answers: { previous_school: 'Sunrise' },
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    // A new upload is stored through F4, reduced to a document reference.
    const res = await inA(() =>
      forms.submitResponse(tenantAId, appId, actorId, {
        answers: {
          previous_school: 'Sunrise',
          report_card: {
            filename: 'report.pdf',
            mime: 'application/pdf',
            contentBase64: Buffer.from('report bytes').toString('base64'),
          },
        },
      }),
    );
    const answer = (res.answers as Record<string, unknown>).report_card as {
      documentId?: string;
      filename?: string;
    };
    expect(typeof answer.documentId).toBe('string');
    expect(answer.filename).toBe('report.pdf');
    // The document really exists, owned by THIS application.
    const doc = await owner.document.findFirst({
      where: {
        id: answer.documentId,
        ownerType: 'AdmissionApplication',
        ownerId: appId,
      },
    });
    expect(doc).toBeTruthy();

    // Re-submitting with the stored reference is accepted (no re-upload).
    const res2 = await inA(() =>
      forms.submitResponse(tenantAId, appId, actorId, {
        answers: {
          previous_school: 'Sunrise',
          report_card: {
            documentId: answer.documentId,
            filename: 'report.pdf',
          },
        },
      }),
    );
    expect(
      (
        (res2.answers as Record<string, unknown>).report_card as {
          documentId?: string;
        }
      ).documentId,
    ).toBe(answer.documentId);

    // A reference to a document that isn't on this application is refused.
    await expect(
      inA(() =>
        forms.submitResponse(tenantAId, appId, actorId, {
          answers: {
            previous_school: 'Sunrise',
            report_card: { documentId: 'not-a-real-doc', filename: 'x.pdf' },
          },
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  // ---- WB3-4 interviews + quiz ----

  it('records a structured interview outcome', async () => {
    const iv = await inA(() =>
      interviews.schedule(tenantAId, appId, actorId, {
        kind: 'interview',
        title: 'Head-teacher chat',
        mode: 'in_person',
        scheduledFor: '2026-03-20T10:00:00.000Z',
      }),
    );
    expect(iv.status).toBe('scheduled');

    const done = await inA(() =>
      interviews.recordOutcome(tenantAId, iv.id, actorId, {
        outcome: 'pass',
        score: 8,
        maxScore: 10,
        notes: 'Confident.',
      }),
    );
    expect(done.status).toBe('completed');
    expect(done.outcome).toBe('pass');
    expect(done.score).toBe(8);
    expect(done.completedAt).toBeTruthy();
  });

  it('auto-marks an exam quiz and flags essays for manual grading', async () => {
    const exam = await inA(() =>
      interviews.schedule(tenantAId, appId, actorId, {
        kind: 'exam',
        title: 'Entrance quiz',
        questions: [
          {
            id: 'q1',
            style: 'mcq',
            text: '2 + 2 = ?',
            options: ['3', '4', '5'],
            correctAnswer: '4',
            points: 2,
          },
          {
            id: 'q2',
            style: 'short_answer',
            text: 'Capital of Nigeria?',
            correctAnswer: 'Abuja',
            points: 3,
          },
          {
            id: 'q3',
            style: 'essay',
            text: 'Why do you want to join?',
            points: 5,
          },
        ],
      }),
    );

    const marked = await inA(() =>
      interviews.submitQuiz(tenantAId, exam.id, actorId, {
        answers: [
          { questionId: 'q1', answer: '4' },
          { questionId: 'q2', answer: 'abuja' }, // case-insensitive
          { questionId: 'q3', answer: 'Because it is great.' },
        ],
      }),
    );
    expect(marked.autoMarked).toBe(true);
    expect(marked.score).toBe(5); // 2 + 3, essay unmarked
    expect(marked.maxScore).toBe(10);
    expect(marked.needsManualGrading).toBe(true);
    expect(marked.status).toBe('completed');

    // A human finalises the essay-inclusive score + outcome.
    const finalised = await inA(() =>
      interviews.recordOutcome(tenantAId, exam.id, actorId, {
        outcome: 'pass',
        score: 9,
        maxScore: 10,
      }),
    );
    expect(finalised.needsManualGrading).toBe(false);
    expect(finalised.score).toBe(9);
  });

  it('refuses a quiz on a non-exam interview and rejects unknown answers', async () => {
    const chat = await inA(() =>
      interviews.schedule(tenantAId, appId, actorId, { kind: 'screening' }),
    );
    await expect(
      inA(() =>
        interviews.submitQuiz(tenantAId, chat.id, actorId, {
          answers: [{ questionId: 'q1', answer: 'x' }],
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  // ---- RLS isolation on the new tables ----

  it('isolates form versions + interviews across tenants (RLS)', async () => {
    const versionsFromB = await inB(() => forms.listVersions(tenantBId));
    expect(versionsFromB).toHaveLength(0);
    const currentFromB = await inB(() => forms.getCurrentForm(tenantBId));
    expect(currentFromB).toBeNull();

    // Tenant B cannot see tenant A's application to schedule against it.
    await expect(
      inB(() => interviews.listForApplication(tenantBId, appId)),
    ).rejects.toThrow();
  });
});
