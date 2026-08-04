/**
 * Secure provisioning (WB1-3) + Guardianship authority/consent (WB1-4) —
 * behavioural proof on the app_runtime (RLS-enforcing) client.
 *
 * WB1-3 acceptance:
 *   - invite → a PENDING account + an expiring F5 SecureLink (hashed at rest) +
 *     a DeliveryAttempt ledger row; the account has NO password yet
 *   - accept → the user sets their OWN password; the account goes ACTIVE
 *   - suspend → the exact flags the login guard reads to refuse a login
 *     (status = suspended, suspended = true); reactivate restores them
 *   - no code path emits a plaintext password
 *
 * WB1-4 acceptance:
 *   - two guardians with distinct authority + contact priority on one ward
 *   - comms audience resolves by relationship + consent (never a gender label):
 *     finance excludes an opted-out guardian; emergency ignores consent
 *   - verify + effective-dated end; ended relationships drop from active + audience
 *   - RLS isolates guardianships across tenants
 *
 * Requires APP_RUNTIME_DATABASE_URL (the restricted role). Skips otherwise —
 * without it RLS is bypassed and the isolation assertions are meaningless.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';

import { AppModule } from '../src/app.module';
import { TenantDbService } from '../src/common';
import { GuardianshipService } from '../src/person/services/guardianship.service';
import { AccountProvisioningService } from '../src/provisioning/services/account-provisioning.service';
import { UserInvitationService } from '../src/tenant/services/user-invitation.service';
import { PasswordResetService } from '../src/auth/services/password-reset.service';
import { makeSuperuserClient } from './helpers/superuser-client';

const HAS_APP_RUNTIME = !!process.env.APP_RUNTIME_DATABASE_URL;
const d = HAS_APP_RUNTIME ? describe : describe.skip;

interface CountRow {
  n: number;
}

d('Provisioning (WB1-3) + Guardianship (WB1-4)', () => {
  let app: INestApplication;
  let owner: ReturnType<typeof makeSuperuserClient>;
  let tenantDb: TenantDbService;
  let guardianships: GuardianshipService;
  let provisioning: AccountProvisioningService;
  let invitations: UserInvitationService;
  let passwordReset: PasswordResetService;

  const stamp = Date.now();
  const A = `prov-a-${stamp}`;
  const B = `prov-b-${stamp}`;
  const inviteeEmail = `prov-invitee-${stamp}@a.test`;

  let tenantAId: string;
  let tenantBId: string;
  let actorId: string;
  let roleId: string;
  let inviteePersonId: string;
  let wardId: string;
  let g1: string;
  let g2: string;

  // shared across ordered tests
  let inviteToken: string;
  let rel1Id: string;
  let rel2Id: string;

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
    guardianships = app.get(GuardianshipService);
    provisioning = app.get(AccountProvisioningService);
    invitations = app.get(UserInvitationService);
    passwordReset = app.get(PasswordResetService);

    const [ta, tb] = await Promise.all([
      owner.tenant.create({
        data: { name: 'Prov A', slug: A, status: 'active' },
      }),
      owner.tenant.create({
        data: { name: 'Prov B', slug: B, status: 'active' },
      }),
    ]);
    tenantAId = ta.id;
    tenantBId = tb.id;

    // A real actor user (audit actorId / suspendedBy references).
    const actor = await owner.user.create({
      data: { email: `prov-actor-${stamp}@a.test`, isActive: true },
    });
    actorId = actor.id;

    // A tenant-scoped role to grant the invited account. Created here (not read
    // from the seed) so the suite is self-contained — CI migrates the e2e DB but
    // does not seed it. Cascades away with tenant A.
    const role = await owner.role.create({
      data: {
        name: `Prov Role ${stamp}`,
        roleType: 'custom',
        clearanceLevel: 3,
        tenantId: tenantAId,
        isActive: true,
      },
    });
    roleId = role.id;

    // A person to invite (no account yet) + an email contact to invite to.
    const invitee = await owner.person.create({
      data: {
        tenantId: tenantAId,
        firstName: 'Ivy',
        lastName: 'Invitee',
        status: 'active',
      },
    });
    inviteePersonId = invitee.id;
    await owner.contactPoint.create({
      data: {
        tenantId: tenantAId,
        personId: invitee.id,
        kind: 'email',
        value: inviteeEmail,
        valueNormalized: inviteeEmail.toLowerCase(),
        isPrimary: true,
      },
    });

    // A ward + two caregivers for the guardianship tests.
    const [ward, guardianA, guardianB] = await Promise.all([
      owner.person.create({
        data: {
          tenantId: tenantAId,
          firstName: 'Wale',
          lastName: 'Ward',
          status: 'active',
        },
      }),
      owner.person.create({
        data: {
          tenantId: tenantAId,
          firstName: 'Mabel',
          lastName: 'Mother',
          status: 'active',
        },
      }),
      owner.person.create({
        data: {
          tenantId: tenantAId,
          firstName: 'Gabriel',
          lastName: 'Grandpa',
          status: 'active',
        },
      }),
    ]);
    wardId = ward.id;
    g1 = guardianA.id;
    g2 = guardianB.id;
  });

  afterAll(async () => {
    if (owner) {
      await owner.tenant.deleteMany({ where: { slug: { in: [A, B] } } });
      await owner.user.deleteMany({
        where: { email: { in: [`prov-actor-${stamp}@a.test`, inviteeEmail] } },
      });
      await owner.$disconnect();
    }
    if (app) await app.close();
  });

  /* ---- WB1-3 · secure provisioning ------------------------------------- */

  it('invite → pending account + SecureLink + DeliveryAttempt; no password yet', async () => {
    await inA(() =>
      provisioning.invite(tenantAId, actorId, inviteePersonId, {
        roleId,
        email: inviteeEmail,
      }),
    );

    const person = await owner.person.findUnique({
      where: { id: inviteePersonId },
      select: { userTenantId: true },
    });
    expect(person?.userTenantId).toBeTruthy();
    const utId = person!.userTenantId!;

    const ut = await owner.userTenant.findUnique({
      where: { id: utId },
      select: {
        status: true,
        invitationToken: true,
        invitationAcceptedAt: true,
        userId: true,
      },
    });
    expect(ut?.status).toBe('pending');
    expect(ut?.invitationToken).toBeTruthy();
    expect(ut?.invitationAcceptedAt).toBeNull();
    inviteToken = ut!.invitationToken!;

    // Governed as a SecureLink — stored hashed, not the raw token.
    const links = await owner.secureLink.findMany({
      where: { tenantId: tenantAId, purpose: 'invitation', targetId: utId },
      select: { tokenHash: true, maxUses: true },
    });
    expect(links.length).toBe(1);
    expect(links[0]!.tokenHash).not.toBe(inviteToken);
    expect(links[0]!.maxUses).toBe(1);

    // Delivery went through the F5 ledger.
    const attempts = await owner.deliveryAttempt.count({
      where: { tenantId: tenantAId, channel: 'email' },
    });
    expect(attempts).toBeGreaterThanOrEqual(1);

    // No plaintext password: the account has none until the invitee sets one.
    const user = await owner.user.findUnique({
      where: { id: ut!.userId },
      select: { passwordHash: true },
    });
    expect(user?.passwordHash).toBeNull();
  });

  it('accept → the invitee sets their OWN password; account goes active', async () => {
    await invitations.acceptInvitation({
      token: inviteToken,
      password: 'ChosenP@ssw0rd1',
    });

    const person = await owner.person.findUnique({
      where: { id: inviteePersonId },
      select: { userTenantId: true },
    });
    const ut = await owner.userTenant.findUnique({
      where: { id: person!.userTenantId! },
      select: {
        status: true,
        invitationAcceptedAt: true,
        invitationToken: true,
        userId: true,
      },
    });
    expect(ut?.status).toBe('active');
    expect(ut?.invitationAcceptedAt).not.toBeNull();
    expect(ut?.invitationToken).toBeNull();

    const user = await owner.user.findUnique({
      where: { id: ut!.userId },
      select: { passwordHash: true },
    });
    expect(user?.passwordHash).toBeTruthy();
    // The password is the one the USER chose — never one we generated/sent.
    expect(await bcrypt.compare('ChosenP@ssw0rd1', user!.passwordHash!)).toBe(
      true,
    );
  });

  it('suspend sets the exact flags the login guard refuses on; reactivate restores', async () => {
    const person = await owner.person.findUnique({
      where: { id: inviteePersonId },
      select: { userTenantId: true },
    });
    const utId = person!.userTenantId!;

    await inA(() =>
      provisioning.suspend(tenantAId, actorId, inviteePersonId, {
        reason: 'left the organisation',
      }),
    );
    let ut = await owner.userTenant.findUnique({
      where: { id: utId },
      select: { status: true, suspended: true, suspensionReason: true },
    });
    // authentication.service refuses a login when status !== ACTIVE || suspended.
    expect(ut?.suspended).toBe(true);
    expect(ut?.status).toBe('suspended');
    expect(ut?.suspensionReason).toBe('left the organisation');

    await inA(() =>
      provisioning.reactivate(tenantAId, actorId, inviteePersonId),
    );
    ut = await owner.userTenant.findUnique({
      where: { id: utId },
      select: { status: true, suspended: true, suspensionReason: true },
    });
    expect(ut?.suspended).toBe(false);
    expect(ut?.status).toBe('active');
    expect(ut?.suspensionReason).toBeNull();
  });

  it('admin reset issues a hashed, redeemable reset token (+ SecureLink)', async () => {
    const person = await owner.person.findUnique({
      where: { id: inviteePersonId },
      select: { userTenantId: true },
    });
    const ut = await owner.userTenant.findUnique({
      where: { id: person!.userTenantId! },
      select: { userId: true },
    });
    // Clear any prior token so we assert on this issuance.
    await owner.user.update({
      where: { id: ut!.userId },
      data: { passwordResetToken: null, passwordResetExpiresAt: null },
    });

    await inA(() =>
      provisioning.sendPasswordReset(tenantAId, actorId, inviteePersonId),
    );

    const user = await owner.user.findUnique({
      where: { id: ut!.userId },
      select: { passwordResetToken: true, passwordResetExpiresAt: true },
    });
    // The same hashed shape the canonical /reset-password resolver reads.
    expect(user?.passwordResetToken).toHaveLength(64); // sha256 hex
    expect(user?.passwordResetExpiresAt!.getTime()).toBeGreaterThan(Date.now());
    const links = await owner.secureLink.count({
      where: { tenantId: tenantAId, purpose: 'password_reset' },
    });
    expect(links).toBeGreaterThanOrEqual(1);
  });

  it('an admin-issued reset token redeems through the canonical reset flow', async () => {
    const person = await owner.person.findUnique({
      where: { id: inviteePersonId },
      select: { userTenantId: true },
    });
    const ut = await owner.userTenant.findUnique({
      where: { id: person!.userTenantId! },
      select: { userId: true },
    });

    // Issue the same admin reset the provisioning service issues, but capture
    // the raw token so we can exercise the actual redemption end-to-end.
    const { token } = await invitations.issueAdminPasswordReset(
      tenantAId,
      ut!.userId,
      actorId,
    );

    const newPassword = 'AdminReset@Pass9';
    await passwordReset.resetPassword(owner as never, token, newPassword);

    const user = await owner.user.findUnique({
      where: { id: ut!.userId },
      select: { passwordHash: true, passwordResetToken: true },
    });
    // The admin-issued token set the password the *user* chose, and was
    // single-use (consumed on redemption).
    expect(await bcrypt.compare(newPassword, user!.passwordHash!)).toBe(true);
    expect(user?.passwordResetToken).toBeNull();
  });

  /* ---- WB1-4 · guardianship authority / priority / consent ------------- */

  it('records two guardians with distinct authority; primary is exclusive', async () => {
    const r1 = await inA(() =>
      guardianships.create(tenantAId, actorId, {
        guardianPersonId: g1,
        wardPersonId: wardId,
        relationship: 'mother',
        isPrimary: true,
        legalGuardian: true,
        isEmergencyContact: true,
        canPickup: true,
      }),
    );
    const r2 = await inA(() =>
      guardianships.create(tenantAId, actorId, {
        guardianPersonId: g2,
        wardPersonId: wardId,
        relationship: 'grandparent',
        consentFinance: false, // opts out of fee comms
        isEmergencyContact: false,
      }),
    );
    rel1Id = r1.id;
    rel2Id = r2.id;

    const list = await inA(() =>
      guardianships.list(tenantAId, { wardPersonId: wardId }),
    );
    expect(list.length).toBe(2);
    // primary first
    expect(list[0]!.relationship).toBe('mother');
    expect(list[0]!.isPrimary).toBe(true);
    expect(list[0]!.legalGuardian).toBe(true);
    expect(list[1]!.relationship).toBe('grandparent');
    expect(list[1]!.isPrimary).toBe(false);

    // Promote the grandparent to primary → the mother is demoted (exactly one).
    await inA(() =>
      guardianships.update(tenantAId, actorId, rel2Id, { isPrimary: true }),
    );
    const after = await inA(() =>
      guardianships.list(tenantAId, { wardPersonId: wardId }),
    );
    const byId = Object.fromEntries(after.map((g) => [g.id, g]));
    expect(byId[rel2Id]!.isPrimary).toBe(true);
    expect(byId[rel1Id]!.isPrimary).toBe(false);

    // Restore the mother as primary for the remaining audience assertions.
    await inA(() =>
      guardianships.update(tenantAId, actorId, rel1Id, { isPrimary: true }),
    );
  });

  it('DB backstop: the partial unique index rejects a 2nd active primary', async () => {
    // Insert straight through the superuser client (bypassing the service's
    // demote) to prove the index — not just app code — guarantees one primary.
    const ward2 = await owner.person.create({
      data: {
        tenantId: tenantAId,
        firstName: 'Solo',
        lastName: 'Ward',
        status: 'active',
      },
    });
    await owner.guardianRelationship.create({
      data: {
        id: randomUUID(),
        tenantId: tenantAId,
        guardianPersonId: g1,
        wardPersonId: ward2.id,
        isPrimary: true,
      },
    });
    await expect(
      owner.guardianRelationship.create({
        data: {
          id: randomUUID(),
          tenantId: tenantAId,
          guardianPersonId: g2,
          wardPersonId: ward2.id,
          isPrimary: true,
        },
      }),
    ).rejects.toThrow(); // unique violation on guardian_relationships_one_primary_per_ward
  });

  it('resolves comms audience by relationship + consent, never a gender label', async () => {
    const finance = await inA(() =>
      guardianships.resolveAudience(tenantAId, wardId, 'finance'),
    );
    // grandparent opted out of finance → only the mother is targeted
    expect(finance.map((m) => m.guardianPersonId)).toEqual([g1]);

    const general = await inA(() =>
      guardianships.resolveAudience(tenantAId, wardId, 'general'),
    );
    expect(new Set(general.map((m) => m.guardianPersonId))).toEqual(
      new Set([g1, g2]),
    );

    const emergency = await inA(() =>
      guardianships.resolveAudience(tenantAId, wardId, 'emergency'),
    );
    // only the mother is an emergency contact — consent is irrelevant here
    expect(emergency.map((m) => m.guardianPersonId)).toEqual([g1]);
  });

  it('verify + effective-dated end drop the relationship from active + audience', async () => {
    await inA(() =>
      guardianships.verify(tenantAId, actorId, rel1Id, 'document'),
    );
    await inA(() =>
      guardianships.end(tenantAId, actorId, rel2Id, 'custody transferred'),
    );

    const active = await inA(() =>
      guardianships.list(tenantAId, { wardPersonId: wardId }),
    );
    expect(active.length).toBe(1);
    expect(active[0]!.verified).toBe(true);

    const general = await inA(() =>
      guardianships.resolveAudience(tenantAId, wardId, 'general'),
    );
    expect(general.map((m) => m.guardianPersonId)).toEqual([g1]);
  });

  it('RLS isolates guardianships across tenants', async () => {
    // Query tenant A's ward while scoped to tenant B: RLS hides A's rows.
    const crossTenant = await inB(() =>
      guardianships.list(tenantAId, { wardPersonId: wardId }),
    );
    expect(crossTenant).toEqual([]);

    // And the raw rows are invisible under B's scope even though they exist.
    const rows = await inB(
      () =>
        tenantDb.client.$queryRaw<CountRow[]>`
          SELECT COUNT(*)::int AS n
          FROM "person"."guardian_relationships"
          WHERE "ward_person_id" = ${wardId}
        `,
    );
    expect(rows[0]!.n).toBe(0);
  });

  /* ---- HTTP boundary: the guard stack rejects unauthenticated calls ----- */

  it('rejects unauthenticated provisioning + guardianship calls at the boundary', async () => {
    const http = app.getHttpServer();
    await request(http).get('/guardianships?wardPersonId=x').expect(401);
    await request(http).post('/guardianships').send({}).expect(401);
    await request(http)
      .get(`/directory/people/${inviteePersonId}/account`)
      .expect(401);
    await request(http)
      .post(`/directory/people/${inviteePersonId}/account/suspend`)
      .send({})
      .expect(401);
  });
});
