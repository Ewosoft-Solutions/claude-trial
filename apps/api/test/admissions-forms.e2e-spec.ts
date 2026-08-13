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
          applicantFirstName: 'Ada',
          applicantMiddleName: 'Forms',
          applicantSurname: 'Okoro',
          yearLevelId,
          guardians: [
            {
              title: 'Mrs',
              firstName: 'Ebele',
              surname: 'Okoro',
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
      // The application form now lives in the generic Form engine tables.
      await owner.formResponse.deleteMany({ where: inTenants });
      await owner.formVersion.deleteMany({ where: inTenants });
      await owner.form.deleteMany({ where: inTenants });
      await owner.admissionInterview.deleteMany({ where: inTenants });
      await owner.admissionStageEvent.deleteMany({ where: inTenants });
      await owner.admissionReview.deleteMany({ where: inTenants });
      await owner.admissionApplicationRequirement.deleteMany({
        where: inTenants,
      });
      await owner.admissionGuardian.deleteMany({ where: inTenants });
      await owner.admissionRequirement.deleteMany({ where: inTenants });
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
  });

  // ---- WB3-3 application form (delegates to the generic Form engine) ----

  const draft = (title: string, withStream = false) => ({
    title,
    sections: [
      {
        id: 's1',
        title: 'Form',
        items: [
          {
            id: 'i1',
            key: 'previous_school',
            type: 'short_text' as const,
            label: 'Previous school',
            required: true,
          },
          ...(withStream
            ? [
                {
                  id: 'i2',
                  key: 'stream_pref',
                  type: 'dropdown' as const,
                  label: 'Stream',
                  options: ['Science', 'Arts'],
                },
              ]
            : []),
        ],
      },
    ],
  });

  it('versions the application form via the engine (publish supersedes, immutable)', async () => {
    const v1 = await inA(() =>
      forms.createDraft(tenantAId, actorId, draft('Intake 2026')),
    );
    expect(v1.version).toBe(1);
    await inA(() => forms.publishVersion(tenantAId, actorId, v1.id));

    let current = await inA(() => forms.getCurrentForm(tenantAId));
    expect(current?.version).toBe(1);
    expect(current?.status).toBe('published');

    // A published version is immutable.
    await expect(
      inA(() => forms.updateDraft(tenantAId, actorId, v1.id, draft('Nope'))),
    ).rejects.toBeInstanceOf(BadRequestException);

    const v2 = await inA(() =>
      forms.createDraft(tenantAId, actorId, draft('Intake 2026 (rev)', true)),
    );
    expect(v2.version).toBe(2);
    await inA(() => forms.publishVersion(tenantAId, actorId, v2.id));

    current = await inA(() => forms.getCurrentForm(tenantAId));
    expect(current?.version).toBe(2);
    const reloadedV1 = await inA(() => forms.getVersion(tenantAId, v1.id));
    expect(reloadedV1.status).toBe('archived');
  });

  it('validates an application response + snapshots the version', async () => {
    // Missing a required field is refused.
    await expect(
      inA(() =>
        forms.submitResponse(tenantAId, appId, actorId, {
          stream_pref: 'Science',
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    // A dropdown value outside the options is refused.
    await expect(
      inA(() =>
        forms.submitResponse(tenantAId, appId, actorId, {
          previous_school: 'Sunrise',
          stream_pref: 'Commerce',
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    // An unknown field key is refused.
    await expect(
      inA(() =>
        forms.submitResponse(tenantAId, appId, actorId, {
          previous_school: 'Sunrise',
          nickname: 'Ada',
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    const res = await inA(() =>
      forms.submitResponse(tenantAId, appId, actorId, {
        previous_school: 'Sunrise Primary',
        stream_pref: 'Science',
      }),
    );
    expect(res.version).toBe(2);
    expect((res.answers as Record<string, unknown>).previous_school).toBe(
      'Sunrise Primary',
    );

    // Re-submitting updates in place (one response per subject per version).
    const res2 = await inA(() =>
      forms.submitResponse(tenantAId, appId, actorId, {
        previous_school: 'Dawn Academy',
        stream_pref: 'Arts',
      }),
    );
    expect(res2.id).toBe(res.id);
    expect((res2.answers as Record<string, unknown>).stream_pref).toBe('Arts');
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
