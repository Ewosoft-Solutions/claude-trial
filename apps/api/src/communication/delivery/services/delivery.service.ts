import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@workspace/database';

import { TenantDbService } from '../../../common/database/tenant-db.service';
import { AuditService } from '../../../common/audit/audit.service';
import { AUDIT_EVENT } from '../../../common/audit/audit.constants';
import { JobService } from '../../../common/jobs/job.service';
import { DELIVERY_SEND_JOB, type DeliverySendPayload } from '../delivery.jobs';
import { classifyDeliveryCost } from '../sms-cost';
import { redactDestination } from '../redact';
import { TemplateService } from './template.service';
import type {
  DeliveryCategory,
  DeliveryChannel,
  DeliveryFailureClass,
  SendIntent,
  SendResult,
} from '../delivery.types';

/**
 * DeliveryService — the single entry point for outbound communication (F5 /
 * ADR-07). A domain publishes a message intent; this service:
 *   1. renders content (direct or from a template),
 *   2. resolves the destination from the Person's primary contact point,
 *   3. enforces consent (a non-critical send to an opted-out recipient is
 *      SUPPRESSED; a `critical` lawful/contractual notice overrides opt-out),
 *   4. classifies metered cost + DND for the ledger,
 *   5. writes a DeliveryAttempt idempotently (one attempt per tenant+dedupeKey),
 *   6. enqueues the actual provider send on an F3 job keyed to the attempt, so a
 *      provider timeout + retry does not double-send a confirmed delivery.
 *
 * MUST be called inside an RLS scope (runScoped) — like JobService.enqueue, the
 * attempt row and the job commit atomically with the caller's domain change.
 */
@Injectable()
export class DeliveryService {
  private readonly logger = new Logger(DeliveryService.name);

  constructor(
    private readonly tenantDb: TenantDbService,
    private readonly jobs: JobService,
    private readonly audit: AuditService,
    private readonly templates: TemplateService,
  ) {}

  private get client(): Prisma.TransactionClient {
    return this.tenantDb.client;
  }

  async send(intent: SendIntent): Promise<SendResult> {
    const channel = intent.channel;
    const category: DeliveryCategory = intent.category ?? 'transactional';
    const content = await this.resolveContent(intent);

    // Consent/DND preferences for this recipient+channel.
    const pref = intent.personId
      ? await this.client.contactPreference.findUnique({
          where: { personId_channel: { personId: intent.personId, channel } },
        })
      : null;

    // Consent gate, by category:
    //  - critical      — a lawful/contractual notice always proceeds.
    //  - marketing      — opt-IN required: suppressed unless the recipient has
    //    EXPLICITLY opted in. A missing preference is NOT consent (NDPA).
    //  - transactional  — opted-in by default: suppressed only on an explicit
    //    opt-out.
    const suppressedByConsent =
      category === 'critical'
        ? false
        : category === 'marketing'
          ? pref?.optedIn !== true
          : pref?.optedIn === false;
    if (suppressedByConsent) {
      return this.record(intent, channel, category, {
        destination: intent.destination ?? '',
        status: 'suppressed',
        failureClass: 'no_consent',
        costUnits: 0,
        dndFlag: pref?.isDnd ?? false,
        enqueue: false,
      });
    }

    const destination = await this.resolveDestination(intent, channel);
    if (!destination) {
      return this.record(intent, channel, category, {
        destination: '',
        status: 'failed',
        failureClass: 'no_contact',
        costUnits: 0,
        dndFlag: false,
        enqueue: false,
      });
    }

    const isDnd = pref?.isDnd ?? false;
    const { costUnits, dndFlag } = classifyDeliveryCost(channel, isDnd);
    // Quiet-hours deferral for non-critical sends (best-effort; UTC minutes).
    const runAfter =
      category === 'critical' ? undefined : this.quietHoursDefer(pref);

    return this.record(intent, channel, category, {
      destination,
      status: 'queued',
      costUnits,
      dndFlag,
      enqueue: true,
      runAfter,
      subject: content.subject,
      body: content.body,
    });
  }

  /**
   * Write (or dedupe to) a DeliveryAttempt and optionally enqueue its send job.
   * Idempotent on (tenant, dedupeKey): a re-send with the same key returns the
   * existing attempt without a second provider send.
   */
  private async record(
    intent: SendIntent,
    channel: DeliveryChannel,
    category: DeliveryCategory,
    opts: {
      destination: string;
      status: 'queued' | 'suppressed' | 'failed';
      failureClass?: DeliveryFailureClass;
      costUnits: number;
      dndFlag: boolean;
      enqueue: boolean;
      runAfter?: Date;
      subject?: string;
      body?: string;
    },
  ): Promise<SendResult> {
    const redacted = redactDestination(channel, opts.destination);
    const { id, deduped } = await this.upsertAttempt({
      tenantId: intent.tenantId,
      channel,
      category,
      recipientPersonId: intent.personId ?? null,
      recipientProfileId: intent.profileId ?? null,
      redactedDestination: redacted,
      status: opts.status,
      failureClass: opts.failureClass ?? null,
      costUnits: opts.costUnits,
      dndFlag: opts.dndFlag,
      templateId: null,
      campaignId: intent.campaignId ?? null,
      secureLinkId: intent.secureLinkId ?? null,
      dedupeKey: intent.dedupeKey ?? null,
      actorId: intent.actorId ?? null,
      metadata: (intent.metadata ?? null) as Prisma.InputJsonValue | null,
    });

    if (deduped) {
      const existing = await this.client.deliveryAttempt.findFirst({
        where: { id },
      });
      return {
        attemptId: id,
        status: (existing?.status as SendResult['status']) ?? 'queued',
        deduped: true,
        costUnits: existing ? Number(existing.costUnits) : opts.costUnits,
        suppressed: existing?.status === 'suppressed',
        failureClass:
          (existing?.failureClass as DeliveryFailureClass) ?? undefined,
      };
    }

    if (opts.enqueue) {
      await this.jobs.enqueue({
        type: DELIVERY_SEND_JOB,
        tenantId: intent.tenantId,
        idempotencyKey: `${DELIVERY_SEND_JOB}:${id}`,
        actorId: intent.actorId ?? null,
        runAfter: opts.runAfter,
        payload: {
          attemptId: id,
          destination: opts.destination,
          subject: opts.subject,
          body: opts.body ?? '',
          from: intent.from,
        } satisfies DeliverySendPayload,
      });
    }

    await this.audit.write({
      tenantId: intent.tenantId,
      eventType: AUDIT_EVENT.DATA_CHANGE,
      action: opts.enqueue
        ? 'communication.delivery.send'
        : 'communication.delivery.suppress',
      resource: 'delivery_attempt',
      resourceId: id,
      actorId: intent.actorId ?? null,
      description: `${channel} ${opts.status} → ${redacted}`,
      metadata: {
        channel,
        category,
        status: opts.status,
        failureClass: opts.failureClass ?? null,
        costUnits: opts.costUnits,
        dndFlag: opts.dndFlag,
        campaignId: intent.campaignId ?? null,
      },
    });

    return {
      attemptId: id,
      status: opts.status,
      deduped: false,
      costUnits: opts.costUnits,
      suppressed: opts.status === 'suppressed',
      failureClass: opts.failureClass,
    };
  }

  /**
   * Insert an attempt, idempotent on (tenant, dedupeKey). When a dedupeKey is
   * present we use INSERT … ON CONFLICT DO NOTHING (so a duplicate never aborts
   * the caller's transaction — mirrors JobService.enqueue); otherwise a plain
   * create (no dedupe requested).
   */
  private async upsertAttempt(row: {
    tenantId: string;
    channel: string;
    category: string;
    recipientPersonId: string | null;
    recipientProfileId: string | null;
    redactedDestination: string;
    status: string;
    failureClass: string | null;
    costUnits: number;
    dndFlag: boolean;
    templateId: string | null;
    campaignId: string | null;
    secureLinkId: string | null;
    dedupeKey: string | null;
    actorId: string | null;
    metadata: Prisma.InputJsonValue | null;
  }): Promise<{ id: string; deduped: boolean }> {
    const client = this.client;
    const id = randomUUID();

    if (!row.dedupeKey) {
      const created = await client.deliveryAttempt.create({
        data: {
          id,
          tenantId: row.tenantId,
          channel: row.channel,
          category: row.category,
          recipientPersonId: row.recipientPersonId,
          recipientProfileId: row.recipientProfileId,
          redactedDestination: row.redactedDestination,
          status: row.status,
          failureClass: row.failureClass,
          costUnits: new Prisma.Decimal(row.costUnits),
          dndFlag: row.dndFlag,
          campaignId: row.campaignId,
          secureLinkId: row.secureLinkId,
          actorId: row.actorId,
          metadata: row.metadata ?? Prisma.JsonNull,
          failedAt: row.status === 'failed' ? new Date() : null,
        },
      });
      return { id: created.id, deduped: false };
    }

    const metaJson = row.metadata == null ? null : JSON.stringify(row.metadata);
    const inserted = await client.$queryRaw<{ id: string }[]>`
      INSERT INTO "communication"."delivery_attempts"
        ("id","tenant_id","channel","category","recipient_person_id",
         "recipient_profile_id","redacted_destination","status","failure_class",
         "cost_units","dnd_flag","campaign_id","secure_link_id","dedupe_key",
         "actor_id","metadata","queued_at","created_at","updated_at")
      VALUES
        (${id}, ${row.tenantId}, ${row.channel}, ${row.category},
         ${row.recipientPersonId}, ${row.recipientProfileId},
         ${row.redactedDestination}, ${row.status}, ${row.failureClass},
         ${row.costUnits}, ${row.dndFlag}, ${row.campaignId},
         ${row.secureLinkId}, ${row.dedupeKey}, ${row.actorId},
         ${metaJson}::jsonb, now(), now(), now())
      ON CONFLICT ("tenant_id","dedupe_key") DO NOTHING
      RETURNING "id"
    `;
    if (inserted.length > 0) {
      return { id: inserted[0].id, deduped: false };
    }
    const existing = await client.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "communication"."delivery_attempts"
      WHERE "tenant_id" = ${row.tenantId} AND "dedupe_key" = ${row.dedupeKey}
      LIMIT 1
    `;
    return { id: existing[0]?.id ?? id, deduped: true };
  }

  private async resolveContent(
    intent: SendIntent,
  ): Promise<{ subject?: string; body: string }> {
    if (intent.templateKey) {
      const rendered = await this.templates.render(
        intent.tenantId,
        intent.templateKey,
        intent.channel,
        intent.locale ?? 'en',
        intent.variables ?? {},
      );
      return { subject: rendered.subject, body: rendered.body };
    }
    if (intent.body == null) {
      throw new BadRequestException(
        'A delivery intent needs either a rendered body or a templateKey.',
      );
    }
    return { subject: intent.subject, body: intent.body };
  }

  /** Resolve the real destination for a channel from the recipient. */
  private async resolveDestination(
    intent: SendIntent,
    channel: DeliveryChannel,
  ): Promise<string | null> {
    if (intent.destination) return intent.destination;
    if (channel === 'in_app') {
      return intent.profileId ?? intent.personId ?? null;
    }
    if (!intent.personId) return null;

    const kind = channel === 'email' ? 'email' : 'phone';
    const contact = await this.client.contactPoint.findFirst({
      where: { personId: intent.personId, kind },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
      select: { value: true },
    });
    return contact?.value ?? null;
  }

  /**
   * Quiet-hours deferral: if the recipient set quiet hours and the current time
   * falls inside the window, delay the send until the window ends. Minutes are
   * interpreted in UTC in this foundation; a tenant-timezone refinement is a
   * follow-up (the columns + hook are in place). Returns undefined when there is
   * nothing to defer.
   */
  private quietHoursDefer(
    pref: {
      quietHoursStart: number | null;
      quietHoursEnd: number | null;
    } | null,
  ): Date | undefined {
    if (!pref || pref.quietHoursStart == null || pref.quietHoursEnd == null) {
      return undefined;
    }
    const { quietHoursStart: start, quietHoursEnd: end } = pref;
    if (start === end) return undefined;
    const now = new Date();
    const minutes = now.getUTCHours() * 60 + now.getUTCMinutes();
    const inWindow =
      start < end
        ? minutes >= start && minutes < end
        : minutes >= start || minutes < end; // window wraps midnight
    if (!inWindow) return undefined;

    const runAfter = new Date(now);
    runAfter.setUTCHours(Math.floor(end / 60), end % 60, 0, 0);
    if (runAfter <= now) runAfter.setUTCDate(runAfter.getUTCDate() + 1);
    return runAfter;
  }
}
