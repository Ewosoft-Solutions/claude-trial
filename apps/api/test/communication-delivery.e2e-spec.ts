/**
 * Communication delivery abstraction (F5 / ADR-07) — behavioural proof.
 *
 * Boots the real AppModule and exercises DeliveryService + the F3 send job on the
 * app_runtime (RLS-enforcing) client. Proves the ADR-07 acceptance criteria:
 *   - a send records costUnits + DND classification; usage() reproduces the
 *     SMS-balance purely from the DeliveryAttempt ledger
 *   - a send is idempotent on (tenant, dedupeKey)
 *   - a provider timeout → job retry → NO double provider send of a confirmed
 *     delivery (adapter idempotency + attempt-status guard)
 *   - a SecureLink expires and denies an unauthorized / mis-addressed redeemer,
 *     and allows a permitted one (permission-checked, not just unguessable)
 *   - a guardian opted out of a non-critical campaign is suppressed, but a
 *     `critical` notice still reaches them
 *   - RLS isolates the ledger: a tenant cannot see another tenant's attempts
 *
 * Requires APP_RUNTIME_DATABASE_URL (the restricted role); skips otherwise —
 * without it the tenant client falls back to the privileged role and the RLS
 * assertions would be meaningless.
 */
import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ForbiddenException,
  GoneException,
} from '@nestjs/common';
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../src/app.module';
import { TenantDbService } from '../src/common';
import { JobWorker } from '../src/common/jobs/job.worker';
import { DeliveryService } from '../src/communication/delivery/services/delivery.service';
import { DeliveryLedgerService } from '../src/communication/delivery/services/delivery-ledger.service';
import { SecureLinkService } from '../src/communication/delivery/services/secure-link.service';
import { CampaignService } from '../src/communication/delivery/services/campaign.service';
import { DeliveryAdapterRegistry } from '../src/communication/delivery/adapters/delivery-adapter.registry';
import type {
  AdapterSendResult,
  ChannelAdapter,
  OutboundMessage,
} from '../src/communication/delivery/delivery.types';
import type { UserPermissionContext } from '../src/auth/services/permission.service';
import { makeSuperuserClient } from './helpers/superuser-client';

const HAS_APP_RUNTIME = !!process.env.APP_RUNTIME_DATABASE_URL;
const d = HAS_APP_RUNTIME ? describe : describe.skip;

d('Communication delivery (F5)', () => {
  let app: INestApplication;
  let owner: ReturnType<typeof makeSuperuserClient>;
  let tenantDb: TenantDbService;
  let delivery: DeliveryService;
  let ledger: DeliveryLedgerService;
  let secureLinks: SecureLinkService;
  let campaigns: CampaignService;
  let adapters: DeliveryAdapterRegistry;
  let worker: JobWorker;
  let originalSms: ChannelAdapter;

  const A = `deliv-a-${Date.now()}`;
  const B = `deliv-b-${Date.now()}`;
  let tenantAId: string;
  let tenantBId: string;
  let personNormal: string; // A: plain SMS recipient (cost 3)
  let personDnd: string; // A: DND recipient (cost 2.5)
  let personOptOut: string; // A: opted out of non-critical sends
  let personB: string; // B: recipient in the other tenant

  const scopedA = <T>(fn: () => Promise<T>) =>
    tenantDb.runScoped(tenantAId, undefined, fn);
  const scopedB = <T>(fn: () => Promise<T>) =>
    tenantDb.runScoped(tenantBId, undefined, fn);

  /** Drain all ready jobs across tenants (the worker is idle in tests). */
  const drain = async () => {
    for (let i = 0; i < 50; i++) {
      if (!(await worker.processOnce())) break;
    }
  };

  const permCtx = (
    perms: string[],
    profileId = 'redeemer',
  ): UserPermissionContext => ({
    userId: 'u',
    tenantId: tenantAId,
    profileId,
    roleId: 'r',
    clearanceLevel: 10,
    permissions: new Map(perms.map((p) => [p, { granted: true }])),
    permissionIds: [],
  });

  const makePerson = async (
    tenantId: string,
    phone: string,
  ): Promise<string> => {
    const person = await owner.person.create({
      data: { tenantId, firstName: 'Test', lastName: randomUUID().slice(0, 6) },
    });
    await owner.contactPoint.create({
      data: {
        tenantId,
        personId: person.id,
        kind: 'phone',
        value: phone,
        valueNormalized: phone,
        isPrimary: true,
      },
    });
    return person.id;
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();

    owner = makeSuperuserClient();
    tenantDb = app.get(TenantDbService);
    delivery = app.get(DeliveryService);
    ledger = app.get(DeliveryLedgerService);
    secureLinks = app.get(SecureLinkService);
    campaigns = app.get(CampaignService);
    adapters = app.get(DeliveryAdapterRegistry);
    worker = app.get(JobWorker);
    originalSms = adapters.get('sms');

    const ta = await owner.tenant.create({
      data: { name: 'Deliv A', slug: A, status: 'active' },
    });
    const tb = await owner.tenant.create({
      data: { name: 'Deliv B', slug: B, status: 'active' },
    });
    tenantAId = ta.id;
    tenantBId = tb.id;

    personNormal = await makePerson(tenantAId, '+2348030000001');
    personDnd = await makePerson(tenantAId, '+2348030000002');
    personOptOut = await makePerson(tenantAId, '+2348030000003');
    personB = await makePerson(tenantBId, '+2348030000004');

    // DND preference (metered differently) and an opt-out (no non-critical send).
    await owner.contactPreference.create({
      data: {
        tenantId: tenantAId,
        personId: personDnd,
        channel: 'sms',
        optedIn: true,
        isDnd: true,
      },
    });
    await owner.contactPreference.create({
      data: {
        tenantId: tenantAId,
        personId: personOptOut,
        channel: 'sms',
        optedIn: false,
      },
    });
  });

  afterAll(async () => {
    adapters.set(originalSms); // restore in case a test swapped it
    if (owner) {
      await owner.tenant.deleteMany({ where: { slug: { in: [A, B] } } });
      await owner.$disconnect();
    }
    if (app) await app.close();
  });

  beforeEach(async () => {
    adapters.set(originalSms);
    const ids = [tenantAId, tenantBId];
    await owner.$executeRaw`DELETE FROM "jobs"."jobs" WHERE "tenant_id" = ANY(${ids})`;
    await owner.$executeRaw`DELETE FROM "communication"."delivery_attempts" WHERE "tenant_id" = ANY(${ids})`;
    await owner.$executeRaw`DELETE FROM "communication"."campaign_recipients" WHERE "tenant_id" = ANY(${ids})`;
    await owner.$executeRaw`DELETE FROM "communication"."campaigns" WHERE "tenant_id" = ANY(${ids})`;
    await owner.$executeRaw`DELETE FROM "communication"."secure_links" WHERE "tenant_id" = ANY(${ids})`;
  });

  it('records metered cost + DND classification and reproduces usage from the ledger', async () => {
    const r1 = await scopedA(() =>
      delivery.send({
        tenantId: tenantAId,
        channel: 'sms',
        personId: personNormal,
        body: 'hello',
      }),
    );
    const r2 = await scopedA(() =>
      delivery.send({
        tenantId: tenantAId,
        channel: 'sms',
        personId: personDnd,
        body: 'hello',
      }),
    );

    expect(r1.costUnits).toBe(3);
    expect(r2.costUnits).toBe(2.5);

    await drain();

    const usage = await scopedA(() => ledger.usage(tenantAId, 'sms'));
    const sms = usage.find((u) => u.channel === 'sms');
    expect(sms?.sentCount).toBe(2);
    expect(sms?.costUnits).toBe(5.5); // 3 (normal) + 2.5 (DND), reproduced from the ledger

    // Both attempts landed in a sent state.
    const rows = await scopedA(() =>
      ledger.list(tenantAId, { channel: 'sms' }),
    );
    expect(rows.rows.every((a) => a.status === 'sent')).toBe(true);
    expect(rows.rows.find((a) => a.id === r2.attemptId)?.dndFlag).toBe(true);
  });

  it('is idempotent on (tenant, dedupeKey)', async () => {
    const key = `idem-${Date.now()}`;
    const first = await scopedA(() =>
      delivery.send({
        tenantId: tenantAId,
        channel: 'sms',
        personId: personNormal,
        body: 'x',
        dedupeKey: key,
      }),
    );
    const second = await scopedA(() =>
      delivery.send({
        tenantId: tenantAId,
        channel: 'sms',
        personId: personNormal,
        body: 'x',
        dedupeKey: key,
      }),
    );

    expect(first.deduped).toBe(false);
    expect(second.deduped).toBe(true);
    expect(second.attemptId).toBe(first.attemptId);

    const count = await owner.$queryRaw<{ n: number }[]>`
      SELECT count(*)::int AS n FROM "communication"."delivery_attempts"
      WHERE "tenant_id" = ${tenantAId} AND "dedupe_key" = ${key}`;
    expect(count[0].n).toBe(1);
  });

  it('does not double-send on a provider retry (idempotency across a timeout)', async () => {
    // An adapter that "accepts" the message (records it) but throws once, as if
    // the provider ack timed out; a retry with the same key is a no-op.
    let realSends = 0;
    const seen = new Set<string>();
    const flaky: ChannelAdapter = {
      channel: 'sms',
      provider: 'test-flaky',
      async send(message: OutboundMessage): Promise<AdapterSendResult> {
        if (seen.has(message.idempotencyKey)) {
          return {
            provider: 'test-flaky',
            providerMessageId: message.idempotencyKey,
            status: 'sent',
          };
        }
        seen.add(message.idempotencyKey);
        realSends++;
        throw new Error('provider ack timeout');
      },
    };
    adapters.set(flaky);

    const { attemptId } = await scopedA(() =>
      delivery.send({
        tenantId: tenantAId,
        channel: 'sms',
        personId: personNormal,
        body: 'once',
      }),
    );

    // Run 1: adapter records + throws → job requeued, attempt still queued.
    await worker.processOnce();
    const afterFail = await owner.$queryRaw<{ status: string }[]>`
      SELECT "status" FROM "communication"."delivery_attempts" WHERE "id" = ${attemptId}`;
    expect(afterFail[0].status).toBe('queued');

    // Skip the backoff, run 2: same key → provider does not re-send.
    await owner.$executeRaw`UPDATE "jobs"."jobs" SET "run_after" = now() WHERE "tenant_id" = ${tenantAId}`;
    await worker.processOnce();

    const afterOk = await owner.$queryRaw<{ status: string }[]>`
      SELECT "status" FROM "communication"."delivery_attempts" WHERE "id" = ${attemptId}`;
    expect(afterOk[0].status).toBe('sent');
    expect(realSends).toBe(1); // exactly one real provider send across the retry
  });

  it('SecureLink: expires + is permission-checked + audience-bound', async () => {
    // Permission-gated link.
    const gated = await scopedA(() =>
      secureLinks.create(tenantAId, 'creator', {
        purpose: 'result',
        targetType: 'result_publication',
        targetId: 'result-1',
        ttlSeconds: 3600,
        requiredPermission: 'results.view',
      }),
    );

    await expect(
      scopedA(() =>
        secureLinks.redeem(tenantAId, gated.token, {
          userContext: permCtx([]),
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    const redeemed = await scopedA(() =>
      secureLinks.redeem(tenantAId, gated.token, {
        userContext: permCtx(['results.view']),
      }),
    );
    expect(redeemed.targetId).toBe('result-1');

    // Expired link (push expiry into the past) → Gone.
    const expiring = await scopedA(() =>
      secureLinks.create(tenantAId, 'creator', {
        purpose: 'result',
        targetType: 'result_publication',
        targetId: 'result-2',
        ttlSeconds: 3600,
      }),
    );
    // Expire it via Prisma (UTC-consistent) rather than SQL now(), which would
    // skew against a `timestamp without time zone` column on a non-UTC host.
    await owner.secureLink.update({
      where: { id: expiring.id },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });
    await expect(
      scopedA(() => secureLinks.redeem(tenantAId, expiring.token, {})),
    ).rejects.toBeInstanceOf(GoneException);

    // Audience-bound link → wrong principal denied, right principal allowed.
    const bound = await scopedA(() =>
      secureLinks.create(tenantAId, 'creator', {
        purpose: 'payment',
        targetType: 'invoice',
        targetId: 'inv-9',
        ttlSeconds: 3600,
        audienceProfileId: 'guardian-1',
      }),
    );
    await expect(
      scopedA(() =>
        secureLinks.redeem(tenantAId, bound.token, {
          profileId: 'someone-else',
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    const okBound = await scopedA(() =>
      secureLinks.redeem(tenantAId, bound.token, { profileId: 'guardian-1' }),
    );
    expect(okBound.targetId).toBe('inv-9');
  });

  it('consent: suppresses a non-critical campaign for an opt-out but delivers to an opted-in recipient + a critical notice', async () => {
    const campaign = await scopedA(() =>
      campaigns.create(tenantAId, 'admin', {
        name: 'Promo',
        channel: 'sms',
        category: 'marketing',
      }),
    );
    // personOptOut (optedIn=false) → suppressed; personDnd (optedIn=true) →
    // delivered. (personNormal has no preference, so marketing to them is
    // correctly suppressed — see the marketing opt-in test.)
    const sent = await scopedA(() =>
      campaigns.send(tenantAId, 'admin', campaign.id, {
        recipientPersonIds: [personOptOut, personDnd],
        body: 'promo',
      }),
    );

    expect(sent.suppressedCount).toBe(1);
    expect(sent.sentCount).toBe(1);

    const suppressed = await owner.$queryRaw<
      { status: string; failure_class: string | null; cost_units: string }[]
    >`SELECT "status","failure_class","cost_units" FROM "communication"."delivery_attempts"
       WHERE "tenant_id" = ${tenantAId} AND "recipient_person_id" = ${personOptOut}`;
    expect(suppressed[0].status).toBe('suppressed');
    expect(suppressed[0].failure_class).toBe('no_consent');
    expect(Number(suppressed[0].cost_units)).toBe(0);

    // A critical notice overrides the opt-out.
    const critical = await scopedA(() =>
      delivery.send({
        tenantId: tenantAId,
        channel: 'sms',
        category: 'critical',
        personId: personOptOut,
        body: 'urgent',
      }),
    );
    expect(critical.suppressed).toBe(false);
    expect(critical.status).toBe('queued');
  });

  it('requires explicit opt-in for marketing (a missing preference is not consent)', async () => {
    // personNormal has NO preference row → a marketing send must be SUPPRESSED
    // (opt-in required; a missing preference is not consent).
    const noPref = await scopedA(() =>
      delivery.send({
        tenantId: tenantAId,
        channel: 'sms',
        category: 'marketing',
        personId: personNormal,
        body: 'promo',
      }),
    );
    expect(noPref.suppressed).toBe(true);
    expect(noPref.failureClass).toBe('no_consent');

    // personDnd explicitly opted in (optedIn: true) → marketing proceeds.
    const optedIn = await scopedA(() =>
      delivery.send({
        tenantId: tenantAId,
        channel: 'sms',
        category: 'marketing',
        personId: personDnd,
        body: 'promo',
      }),
    );
    expect(optedIn.suppressed).toBe(false);
    expect(optedIn.status).toBe('queued');
  });

  it('records a terminal provider failure on the ledger (dead job → failed attempt)', async () => {
    const alwaysFail: ChannelAdapter = {
      channel: 'sms',
      provider: 'test-dead',
      async send(): Promise<AdapterSendResult> {
        throw new Error('provider down');
      },
    };
    adapters.set(alwaysFail);

    const { attemptId } = await scopedA(() =>
      delivery.send({
        tenantId: tenantAId,
        channel: 'sms',
        personId: personNormal,
        body: 'x',
      }),
    );
    // Force a single attempt so the first failure is terminal.
    await owner.$executeRaw`UPDATE "jobs"."jobs" SET "max_attempts" = 1 WHERE "tenant_id" = ${tenantAId}`;
    await worker.processOnce();

    const row = await owner.$queryRaw<
      { status: string; failure_class: string | null; error: string | null }[]
    >`SELECT "status","failure_class","error" FROM "communication"."delivery_attempts" WHERE "id" = ${attemptId}`;
    expect(row[0].status).toBe('failed'); // no longer orphaned as 'queued'
    expect(row[0].failure_class).toBe('provider_error');
    expect(row[0].error).toContain('provider down');
  });

  it('enforces single-use SecureLinks (a second redemption is Gone)', async () => {
    const once = await scopedA(() =>
      secureLinks.create(tenantAId, 'creator', {
        purpose: 'result',
        targetType: 'result_publication',
        targetId: 'r-once',
        ttlSeconds: 3600,
        maxUses: 1,
      }),
    );
    const first = await scopedA(() =>
      secureLinks.redeem(tenantAId, once.token, {}),
    );
    expect(first.targetId).toBe('r-once');
    await expect(
      scopedA(() => secureLinks.redeem(tenantAId, once.token, {})),
    ).rejects.toBeInstanceOf(GoneException);
  });

  it('audits a denied SecureLink redemption as a security event', async () => {
    const gated = await scopedA(() =>
      secureLinks.create(tenantAId, 'creator', {
        purpose: 'result',
        targetType: 'result_publication',
        targetId: 'r-denied',
        ttlSeconds: 3600,
        requiredPermission: 'results.view',
      }),
    );
    await expect(
      scopedA(() =>
        secureLinks.redeem(tenantAId, gated.token, {
          userContext: permCtx([]),
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    const audit = await owner.$queryRaw<{ n: number }[]>`
      SELECT count(*)::int AS n FROM "audit-logging"."audit_logs"
      WHERE "tenant_id" = ${tenantAId}
        AND "action" = 'communication.secure_link.denied'
        AND "resource_id" = ${gated.id}`;
    expect(audit[0].n).toBeGreaterThanOrEqual(1);
  });

  it('isolates the delivery ledger by tenant (RLS): A cannot see B attempts', async () => {
    const b = await scopedB(() =>
      delivery.send({
        tenantId: tenantBId,
        channel: 'sms',
        personId: personB,
        body: 'b-only',
      }),
    );

    const fromA = await scopedA(() =>
      tenantDb.client.deliveryAttempt.findFirst({ where: { id: b.attemptId } }),
    );
    const fromB = await scopedB(() =>
      tenantDb.client.deliveryAttempt.findFirst({ where: { id: b.attemptId } }),
    );

    expect(fromA).toBeNull();
    expect(fromB?.id).toBe(b.attemptId);
  });
});
