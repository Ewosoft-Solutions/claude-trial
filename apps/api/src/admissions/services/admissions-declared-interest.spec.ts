/**
 * Separation of duties on admissions decisions.
 *
 * Admissions is the one approval flow with no pair of ids to compare: the
 * applicant is an external prospect, not a user account, so "you are deciding
 * your own child's application" cannot be detected — only declared. These specs
 * pin what a declaration then costs you, and what it deliberately does not.
 *
 * See docs/self-approval-audit.md, row 12.
 */
import { ForbiddenException } from '@nestjs/common';

import { AdmissionsService } from './admissions.service';

const TENANT = 'tenant-1';
const APP = 'app-1';
const DECLARER = 'user-declarer';
const OTHER = 'user-other';

const APPLICATION = {
  id: APP,
  tenantId: TENANT,
  stage: 'application',
  decision: 'pending',
  guardianEmail: 'parent@example.com',
  guardianPhone: '+234 803 123 4567',
  guardians: [],
  requirements: [],
  stageEvents: [],
  reviews: [],
  interestDeclarations: [],
};

function makeService(options: {
  declarations?: Record<string, unknown>[];
  application?: Record<string, unknown>;
  me?: { email: string | null; phone: string | null } | null;
}) {
  const declarations = options.declarations ?? [];
  const application = {
    ...APPLICATION,
    ...(options.application ?? {}),
    interestDeclarations: declarations,
  };
  const client = {
    admissionApplication: {
      findFirst: jest.fn().mockResolvedValue(application),
      update: jest.fn().mockResolvedValue(application),
    },
    admissionInterestDeclaration: {
      findFirst: jest
        .fn()
        .mockImplementation((args: { where: { userId: string } }) =>
          Promise.resolve(
            declarations.find((d) => d.userId === args.where.userId) ?? null,
          ),
        ),
      upsert: jest
        .fn()
        .mockImplementation((args: { create: unknown }) =>
          Promise.resolve({ id: 'decl-1', ...(args.create as object) }),
        ),
    },
    admissionStageEvent: { create: jest.fn().mockResolvedValue({}) },
    admissionReview: { create: jest.fn().mockResolvedValue({}) },
    user: {
      findUnique: jest
        .fn()
        .mockResolvedValue(
          options.me === undefined
            ? { email: 'staff@example.com', phone: null }
            : options.me,
        ),
    },
  };
  const audit = { write: jest.fn().mockResolvedValue(undefined) };
  const service = new AdmissionsService(
    { client } as never,
    audit as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  return { service, client, audit };
}

const DECLARED = [
  { id: 'decl-1', userId: DECLARER, relationship: 'parent', note: 'My son', declaredAt: new Date('2026-08-21') },
];

describe('AdmissionsService — declared interest', () => {
  describe('closes every path that shapes the outcome', () => {
    // Each of these is a way to steer the result, so each is closed. Filing a
    // review is included on purpose: an opinion on the record moves a decision
    // just as surely as making it.
    it.each([
      [
        'advanceStage',
        (s: AdmissionsService) =>
          s.advanceStage(TENANT, APP, { toStage: 'interview' } as never, DECLARER),
      ],
      [
        'addReview',
        (s: AdmissionsService) =>
          s.addReview(TENANT, APP, { recommendation: 'admit' } as never, DECLARER),
      ],
      [
        'makeOffer',
        (s: AdmissionsService) => s.makeOffer(TENANT, APP, {} as never, DECLARER),
      ],
      [
        'recordAcceptance',
        (s: AdmissionsService) => s.recordAcceptance(TENANT, APP, DECLARER),
      ],
      [
        'reject',
        (s: AdmissionsService) => s.reject(TENANT, APP, {} as never, DECLARER),
      ],
      [
        'convertToStudent',
        (s: AdmissionsService) =>
          s.convertToStudent(
            TENANT,
            { userId: DECLARER, grantScope: null } as never,
            APP,
            {} as never,
          ),
      ],
    ])('refuses %s to someone who declared an interest', async (_name, call) => {
      const { service } = makeService({ declarations: DECLARED });
      await expect(call(service)).rejects.toThrow(ForbiddenException);
    });

    it('leaves those same paths open to a colleague', async () => {
      // The declaration is personal, not a lock on the application — one
      // person stepping away must not freeze the pipeline for everyone.
      const { service } = makeService({
        declarations: DECLARED,
        application: { stage: 'offer' },
      });
      await expect(
        service.recordAcceptance(TENANT, APP, OTHER),
      ).resolves.toBeDefined();
    });
  });

  describe('what a declaration deliberately does NOT close', () => {
    it('still lets the declarer edit the application', async () => {
      // Editing is clerical. Blocking it would strand routine work — someone
      // who stepped away from the decision can still correct a phone number.
      const { service } = makeService({ declarations: DECLARED });
      await expect(
        service.updateApplication(TENANT, APP, {} as never, DECLARER),
      ).resolves.toBeDefined();
    });

    it('still lets the declarer read the application', async () => {
      // A declarer should be able to see what happened to something they
      // stepped away from.
      const { service } = makeService({ declarations: DECLARED });
      await expect(
        service.getApplication(TENANT, APP, DECLARER),
      ).resolves.toBeDefined();
    });
  });

  describe('declaring', () => {
    it('is not revocable — the write can only ever upsert', async () => {
      const { service, client } = makeService({});
      await service.declareInterest(TENANT, APP, DECLARER, {
        relationship: 'parent',
      } as never);
      expect(client.admissionInterestDeclaration.upsert).toHaveBeenCalled();
      expect(
        (client.admissionInterestDeclaration as Record<string, unknown>).delete,
      ).toBeUndefined();
    });

    it('writes an audit entry naming the relationship', async () => {
      const { service, audit } = makeService({});
      await service.declareInterest(TENANT, APP, DECLARER, {
        relationship: 'parent',
      } as never);
      expect(audit.write).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'admissions.interest.declared',
          metadata: { relationship: 'parent' },
        }),
      );
    });
  });

  describe('what the read tells the client', () => {
    it('withholds canDecide from the declarer and keeps it for everyone else', async () => {
      const { service } = makeService({ declarations: DECLARED });
      const mine = await service.getApplication(TENANT, APP, DECLARER);
      const theirs = await service.getApplication(TENANT, APP, OTHER);
      expect(mine.canDecide).toBe(false);
      expect(theirs.canDecide).toBe(true);
    });

    it('never leaks the private note behind someone else’s recusal', async () => {
      // Who stepped away is worth showing. Why they said they had to is not.
      const { service } = makeService({ declarations: DECLARED });
      const app = await service.getApplication(TENANT, APP, OTHER);
      expect(app.interestDeclarations[0]).not.toHaveProperty('note');
      expect(app.myDeclaredInterest).toBeNull();
    });

    it('gives the declarer their own note back', async () => {
      const { service } = makeService({ declarations: DECLARED });
      const app = await service.getApplication(TENANT, APP, DECLARER);
      expect(app.myDeclaredInterest).toMatchObject({
        relationship: 'parent',
        note: 'My son',
      });
    });

    it('hints when the viewer’s own email is on the application', async () => {
      const { service } = makeService({
        me: { email: 'Parent@Example.com ', phone: null },
      });
      const app = await service.getApplication(TENANT, APP, OTHER);
      expect(app.looksConnected).toBe(true);
      expect(app.canDecide).toBe(true); // a hint, never a block
    });

    it('matches a phone across +234 and 0 forms', async () => {
      const { service } = makeService({
        me: { email: 'staff@example.com', phone: '0803 123 4567' },
      });
      const app = await service.getApplication(TENANT, APP, OTHER);
      expect(app.looksConnected).toBe(true);
    });

    it('does not hint on an unrelated contact', async () => {
      const { service } = makeService({
        me: { email: 'staff@example.com', phone: '0801 999 0000' },
      });
      const app = await service.getApplication(TENANT, APP, OTHER);
      expect(app.looksConnected).toBe(false);
    });

    it('stops hinting once the connection has been declared', async () => {
      // The nudge exists to produce a declaration; once it has one, it is noise.
      const { service } = makeService({
        declarations: DECLARED,
        me: { email: 'parent@example.com', phone: null },
      });
      const app = await service.getApplication(TENANT, APP, DECLARER);
      expect(app.looksConnected).toBe(false);
    });

    it('reads neutral for an actorless (portal) read', async () => {
      const { service } = makeService({ declarations: DECLARED });
      const app = await service.getApplication(TENANT, APP);
      expect(app.canDecide).toBe(true);
      expect(app.looksConnected).toBe(false);
    });
  });
});
