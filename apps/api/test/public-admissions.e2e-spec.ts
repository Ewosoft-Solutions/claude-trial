/**
 * Applicant self-service portal — public apply + SecureLink status portal
 * (behavioural proof on the app_runtime / RLS-enforcing client).
 *
 * Acceptance:
 *   - a public GET exposes the school's intake (structure + published form);
 *   - a public apply creates a real application + returns a re-checkable status
 *     token; the status read is a NARROW projection (no reviews / notes);
 *   - a required document uploads through the token; an offer accepts;
 *   - a bad token is rejected; the per-IP submit rate-limit trips;
 *   - staff can mint a status link for any application.
 *
 * Requires APP_RUNTIME_DATABASE_URL; skips otherwise.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, INestApplication } from '@nestjs/common';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

import { AppModule } from '../src/app.module';
import { TenantDbService } from '../src/common';
import { AdmissionsService } from '../src/admissions/services/admissions.service';
import { AdmissionFormsService } from '../src/admissions/services/admission-forms.service';
import { PublicAdmissionsService } from '../src/admissions/services/public-admissions.service';
import { makeSuperuserClient } from './helpers/superuser-client';

const R2_KEYS = [
  'R2_ACCOUNT_ID',
  'R2_BUCKET',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
] as const;
const savedR2: Record<string, string | undefined> = {};

const HAS_APP_RUNTIME = !!process.env.APP_RUNTIME_DATABASE_URL;
const d = HAS_APP_RUNTIME ? describe : describe.skip;

d('Public admissions — apply + status portal', () => {
  let app: INestApplication;
  let owner: ReturnType<typeof makeSuperuserClient>;
  let tenantDb: TenantDbService;
  let portal: PublicAdmissionsService;
  let admissions: AdmissionsService;
  let forms: AdmissionFormsService;

  const stamp = Date.now();
  const slug = `portal-a-${stamp}`;
  let tenantId: string;
  let actorId: string;
  let yearLevelId: string;

  const applyDto = () => ({
    applicantName: 'Ada Portal Okoro',
    yearLevelId,
    guardians: [
      {
        fullName: 'Mrs Okoro',
        relationship: 'mother' as const,
        phoneCountryCode: '+234',
        phoneNumber: '8012345678',
        whatsappSameAsPhone: true,
        isPrimary: true,
      },
    ],
  });

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
    portal = app.get(PublicAdmissionsService);
    admissions = app.get(AdmissionsService);
    forms = app.get(AdmissionFormsService);

    const [t, actor] = await Promise.all([
      owner.tenant.create({
        data: {
          name: 'Portal A',
          slug,
          status: 'active',
          schoolType: 'primary',
        },
      }),
      owner.user.create({
        data: { email: `portal-actor-${stamp}@a.test`, isActive: true },
      }),
    ]);
    tenantId = t.id;
    actorId = actor.id;

    const stage = await owner.stage.create({
      data: { tenantId, name: 'Primary', code: 'PRI' },
    });
    const year = await owner.yearLevel.create({
      data: { tenantId, stageId: stage.id, name: 'Primary 5', code: 'P5' },
    });
    yearLevelId = year.id;

    // Publish an application form so the intake exposes it.
    await tenantDb.runScoped(tenantId, actorId, async () => {
      const draft = await forms.createDraft(tenantId, actorId, {
        title: 'Intake form',
        sections: [
          {
            id: 's1',
            title: 'Form',
            items: [
              {
                id: 'i1',
                key: 'previous_school',
                type: 'short_text',
                label: 'Previous school',
              },
            ],
          },
        ],
      });
      await forms.publishVersion(tenantId, actorId, draft.id);
    });
  });

  afterAll(async () => {
    if (owner) {
      const where = { tenantId };
      await owner.secureLink.deleteMany({ where });
      await owner.document.deleteMany({ where });
      await owner.formResponse.deleteMany({ where });
      await owner.formVersion.deleteMany({ where });
      await owner.form.deleteMany({ where });
      await owner.admissionStageEvent.deleteMany({ where });
      await owner.admissionReview.deleteMany({ where });
      await owner.admissionApplicationRequirement.deleteMany({ where });
      await owner.admissionGuardian.deleteMany({ where });
      await owner.admissionRequirement.deleteMany({ where });
      await owner.admissionApplication.deleteMany({ where });
      await owner.yearLevel.deleteMany({ where });
      await owner.stage.deleteMany({ where });
      await owner.tenant.deleteMany({ where: { slug } });
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

  it('exposes the public intake (school + structure + form)', async () => {
    const intake = await portal.getIntake(slug);
    expect(intake.school.name).toBe('Portal A');
    expect(intake.structure.yearLevels.some((y) => y.id === yearLevelId)).toBe(
      true,
    );
    expect(intake.form?.version).toBe(1);
  });

  it('a public apply creates an application + a re-checkable status token', async () => {
    const result = await portal.apply(
      slug,
      { ...applyDto(), formAnswers: { previous_school: 'Sunrise' } },
      '203.0.113.10',
    );
    expect(result.reference).toBeTruthy();
    expect(result.statusToken).toBeTruthy();

    const status = await portal.getStatus(result.statusToken);
    expect(status.applicantName).toBe('Ada Portal Okoro');
    expect(status.stage).toBe('applied');
    expect(status.requirements.length).toBeGreaterThan(0);
    expect(status.stageHistory.map((h) => h.toStage)).toContain('applied');
    // PII boundary: the projection never carries internal fields.
    expect(status).not.toHaveProperty('reviews');
    expect(status).not.toHaveProperty('notes');
    expect(status).not.toHaveProperty('guardians');
  });

  it('uploads a required document + accepts an offer through the token', async () => {
    const { statusToken } = await portal.apply(
      slug,
      applyDto(),
      '203.0.113.11',
    );

    let status = await portal.getStatus(statusToken);
    const doc = status.requirements.find(
      (r) => r.type === 'document' && r.status === 'pending',
    );
    expect(doc).toBeTruthy();

    await portal.uploadDocument(statusToken, doc!.id, {
      mime: 'image/jpeg',
      filename: 'birth-cert.jpg',
      contentBase64: Buffer.from('hello').toString('base64'),
    });
    status = await portal.getStatus(statusToken);
    expect(status.requirements.find((r) => r.id === doc!.id)?.status).toBe(
      'provided',
    );

    // Staff make an offer, then the applicant accepts via the portal.
    await tenantDb.runScoped(tenantId, actorId, () =>
      admissions.makeOffer(tenantId, status.reference, {}, actorId),
    );
    const accepted = await portal.accept(statusToken);
    expect(accepted.stage).toBe('accepted');
  });

  it('rejects a bad status token', async () => {
    await expect(portal.getStatus('not-a-real-token')).rejects.toBeInstanceOf(
      Error,
    );
  });

  it('lets staff mint a status link for any application', async () => {
    const created = await tenantDb.runScoped(tenantId, actorId, () =>
      admissions.createApplication(tenantId, applyDto(), actorId),
    );
    const { statusToken } = await tenantDb.runScoped(tenantId, actorId, () =>
      admissions.createStatusLink(tenantId, actorId, created.id),
    );
    const status = await portal.getStatus(statusToken);
    expect(status.reference).toBe(created.id);
  });

  it('rate-limits repeated public submits from one IP', async () => {
    const ip = '203.0.113.99';
    // RATE_MAX (6) succeed, the next trips.
    for (let i = 0; i < 6; i++) {
      await portal.apply(slug, applyDto(), ip);
    }
    await expect(portal.apply(slug, applyDto(), ip)).rejects.toBeInstanceOf(
      HttpException,
    );
  });
});
