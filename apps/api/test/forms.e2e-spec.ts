/**
 * Form Engine (P1) — the generic Forms subsystem, on the app_runtime
 * (RLS-enforcing) client.
 *
 * Acceptance:
 *   - a form versions: draft → publish (immutable) → a new draft supersedes;
 *   - answers are validated by type + rules (email, integer range, options);
 *   - BRANCHING: required is enforced only on reached sections; a choice routes
 *     the respondent to a later section;
 *   - a `file` item materialises through F4 to a document reference; a re-submit
 *     with the stored ref is accepted, a foreign ref rejected;
 *   - RLS isolates forms across tenants.
 *
 * Requires APP_RUNTIME_DATABASE_URL; skips otherwise.
 */
import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  INestApplication,
  NotFoundException,
} from '@nestjs/common';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

import { AppModule } from '../src/app.module';
import { TenantDbService } from '../src/common';
import { FormsService } from '../src/forms/forms.service';
import { makeSuperuserClient } from './helpers/superuser-client';

const HAS_APP_RUNTIME = !!process.env.APP_RUNTIME_DATABASE_URL;
const d = HAS_APP_RUNTIME ? describe : describe.skip;

// A `file` item uploads through F4 — pin the local-disk storage provider.
const R2_KEYS = [
  'R2_ACCOUNT_ID',
  'R2_BUCKET',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
] as const;
const savedR2: Record<string, string | undefined> = {};

d('Forms engine (P1)', () => {
  let app: INestApplication;
  let owner: ReturnType<typeof makeSuperuserClient>;
  let tenantDb: TenantDbService;
  let forms: FormsService;

  const stamp = Date.now();
  const A = `forms-a-${stamp}`;
  const B = `forms-b-${stamp}`;
  let tenantAId: string;
  let tenantBId: string;
  let actorId: string;
  let formId: string;
  let versionId: string;

  const subjectType = 'TestSubject';
  const subjectId = `subj-${stamp}`;

  const inA = <T>(fn: () => Promise<T>) =>
    tenantDb.runScoped(tenantAId, actorId, fn);
  const inB = <T>(fn: () => Promise<T>) =>
    tenantDb.runScoped(tenantBId, actorId, fn);

  // A two-section form: choosing 'SSS' branches into a second section whose
  // `report_card` file is required; 'JSS' skips straight to submit.
  const definition = () => ({
    title: 'Test intake',
    description: 'A generic form',
    sections: [
      {
        id: 's1',
        title: 'About you',
        items: [
          {
            id: 'i1',
            key: 'full_name',
            type: 'short_text' as const,
            label: 'Full name',
            required: true,
            validation: { minLength: 2, maxLength: 50 },
          },
          {
            id: 'i2',
            key: 'email',
            type: 'short_text' as const,
            label: 'Email',
            required: true,
            validation: { kind: 'email' as const },
          },
          {
            id: 'i3',
            key: 'age',
            type: 'number' as const,
            label: 'Age',
            validation: { kind: 'integer' as const, min: 0, max: 120 },
          },
          {
            id: 'i4',
            key: 'phone',
            type: 'phone' as const,
            label: 'Phone',
            required: true,
          },
          {
            id: 'i5',
            key: 'address',
            type: 'address' as const,
            label: 'Address',
          },
          {
            id: 'i6',
            key: 'level',
            type: 'radio' as const,
            label: 'Level',
            options: ['JSS', 'SSS'],
            required: true,
            branching: [{ answer: 'SSS', goTo: 's2' }],
          },
        ],
        next: 'submit',
      },
      {
        id: 's2',
        title: 'Senior details',
        items: [
          {
            id: 'i7',
            key: 'stream',
            type: 'dropdown' as const,
            label: 'Stream',
            options: ['Science', 'Arts'],
          },
          {
            id: 'i8',
            key: 'subjects',
            type: 'checkboxes' as const,
            label: 'Subjects',
            options: ['Maths', 'English', 'Physics'],
          },
          {
            id: 'i9',
            key: 'rating',
            type: 'linear_scale' as const,
            label: 'Confidence',
            scale: { min: 1, max: 5 },
          },
          {
            id: 'i10',
            key: 'report_card',
            type: 'file' as const,
            label: 'Report card',
            required: true,
          },
        ],
      },
    ],
  });

  const base = () => ({
    full_name: 'Ada Okoro',
    email: 'ada@example.com',
    phone: { number: '8012345678' },
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
    forms = app.get(FormsService);

    const [ta, tb, actor] = await Promise.all([
      owner.tenant.create({
        data: {
          name: 'Forms A',
          slug: A,
          status: 'active',
          schoolType: 'secondary',
        },
      }),
      owner.tenant.create({
        data: {
          name: 'Forms B',
          slug: B,
          status: 'active',
          schoolType: 'secondary',
        },
      }),
      owner.user.create({
        data: { email: `forms-actor-${stamp}@a.test`, isActive: true },
      }),
    ]);
    tenantAId = ta.id;
    tenantBId = tb.id;
    actorId = actor.id;
  });

  afterAll(async () => {
    if (owner) {
      const where = { tenantId: { in: [tenantAId, tenantBId] } };
      await owner.formResponse.deleteMany({ where });
      await owner.formVersion.deleteMany({ where });
      await owner.form.deleteMany({ where });
      await owner.document.deleteMany({ where });
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

  it('versions a form: draft → publish → immutable', async () => {
    const form = await inA(() =>
      forms.getOrCreateForm(
        tenantAId,
        actorId,
        { ownerType: 'Tenant', ownerId: tenantAId, purpose: 'test.intake' },
        'Test intake',
      ),
    );
    formId = form.id;

    const v1 = await inA(() =>
      forms.createDraft(tenantAId, actorId, formId, definition()),
    );
    expect(v1.version).toBe(1);
    await inA(() => forms.publishVersion(tenantAId, actorId, v1.id));
    versionId = v1.id;

    const current = await inA(() =>
      forms.getCurrentPublished(tenantAId, formId),
    );
    expect(current?.id).toBe(v1.id);

    // A published version is immutable.
    await expect(
      inA(() => forms.updateDraft(tenantAId, actorId, v1.id, definition())),
    ).rejects.toBeInstanceOf(BadRequestException);

    // A new draft supersedes on publish (v1 archived).
    const v2 = await inA(() =>
      forms.createDraft(tenantAId, actorId, formId, definition()),
    );
    expect(v2.version).toBe(2);
    await inA(() => forms.publishVersion(tenantAId, actorId, v2.id));
    const reV1 = await inA(() => forms.getVersion(tenantAId, v1.id));
    expect(reV1.status).toBe('archived');
    // Keep testing against v1 (published earlier); re-publishing v1 is refused.
    versionId = v2.id;
  });

  it('validates by type + rules; branching skips the senior section for JSS', async () => {
    const submit = (answers: Record<string, unknown>) =>
      inA(() =>
        forms.submitResponse(tenantAId, actorId, {
          formVersionId: versionId,
          subjectType,
          subjectId,
          answers,
        }),
      );

    // Missing a required field (full_name).
    await expect(
      submit({ email: 'a@b.com', phone: { number: '801' }, level: 'JSS' }),
    ).rejects.toBeInstanceOf(BadRequestException);

    // A malformed email.
    await expect(
      submit({ ...base(), email: 'not-an-email', level: 'JSS' }),
    ).rejects.toBeInstanceOf(BadRequestException);

    // Age out of range.
    await expect(
      submit({ ...base(), age: 500, level: 'JSS' }),
    ).rejects.toBeInstanceOf(BadRequestException);

    // A choice outside the options.
    await expect(
      submit({ ...base(), level: 'PRIMARY' }),
    ).rejects.toBeInstanceOf(BadRequestException);

    // Valid JSS submit — branch skips s2, so report_card is NOT required.
    const res = await submit({
      ...base(),
      age: 12,
      address: '12 Awolowo Rd, Lagos',
      level: 'JSS',
    });
    const a = res.answers as Record<string, any>;
    expect(a.phone).toEqual({ dialCode: '+234', number: '8012345678' });
    expect(a.address.formatted).toBe('12 Awolowo Rd, Lagos');
    expect(a.level).toBe('JSS');
    expect(a.report_card).toBeUndefined();
  });

  it('branching enforces the senior section for SSS + materialises a file', async () => {
    const submit = (answers: Record<string, unknown>) =>
      inA(() =>
        forms.submitResponse(tenantAId, actorId, {
          formVersionId: versionId,
          subjectType,
          subjectId,
          answers,
        }),
      );

    // SSS reaches s2 → the required report_card is now enforced.
    await expect(
      submit({ ...base(), level: 'SSS', stream: 'Science' }),
    ).rejects.toBeInstanceOf(BadRequestException);

    // A new file upload is stored through F4 → a document reference.
    const res = await submit({
      ...base(),
      level: 'SSS',
      stream: 'Science',
      subjects: ['Maths', 'Physics'],
      rating: 4,
      report_card: {
        filename: 'report.pdf',
        mime: 'application/pdf',
        contentBase64: Buffer.from('report bytes').toString('base64'),
      },
    });
    const a = res.answers as Record<string, any>;
    expect(typeof a.report_card.documentId).toBe('string');
    expect(a.subjects).toEqual(['Maths', 'Physics']);
    expect(a.rating).toBe(4);
    const docId = a.report_card.documentId as string;

    // Re-submitting with the stored reference is accepted (no re-upload).
    const res2 = await submit({
      ...base(),
      level: 'SSS',
      stream: 'Science',
      report_card: { documentId: docId, filename: 'report.pdf' },
    });
    expect((res2.answers as Record<string, any>).report_card.documentId).toBe(
      docId,
    );

    // A reference to a document that isn't on this subject is refused.
    await expect(
      submit({
        ...base(),
        level: 'SSS',
        stream: 'Science',
        report_card: { documentId: 'not-a-real-doc', filename: 'x.pdf' },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('isolates forms across tenants (RLS)', async () => {
    await expect(
      inB(() => forms.getForm(tenantBId, formId)),
    ).rejects.toBeInstanceOf(NotFoundException);
    const versionsB = await inB(() => forms.listVersions(tenantBId, formId));
    expect(versionsB.length).toBe(0);
  });
});
