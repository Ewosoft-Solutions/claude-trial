import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@workspace/database';

import { TenantDbService } from '../../../common/database/tenant-db.service';
import { AuditService } from '../../../common/audit/audit.service';
import { AUDIT_EVENT } from '../../../common/audit/audit.constants';
import { DeliveryService } from './delivery.service';
import type { DeliveryCategory, DeliveryChannel } from '../delivery.types';

export interface CreateCampaignInput {
  name: string;
  channel: DeliveryChannel;
  category?: DeliveryCategory;
  templateKey?: string;
  audience?: Record<string, unknown>;
}

export interface SendCampaignInput {
  /** Recipient persons, resolved from real relationships/permissions upstream. */
  recipientPersonIds: string[];
  /** Direct content (or rely on the campaign's templateKey). */
  body?: string;
  subject?: string;
  variables?: Record<string, unknown>;
}

/**
 * Campaigns — bulk sends whose reach + cost reproduce from the ledger. Fan-out
 * routes every recipient through DeliveryService, so consent/DND/quiet-hours and
 * the DeliveryAttempt evidence apply uniformly: an opted-out recipient of a
 * non-critical campaign is suppressed, while a `critical` campaign still reaches
 * them. Audience is a list of Persons (resolved from real relationships), never
 * a gender label.
 *
 * The fan-out here is synchronous for modest audiences; a large wave should be
 * chunked onto F3 jobs (a WB6/WB11 follow-up — the per-recipient send already
 * runs on a job, this only concerns the fan-out loop).
 */
@Injectable()
export class CampaignService {
  constructor(
    private readonly tenantDb: TenantDbService,
    private readonly audit: AuditService,
    private readonly delivery: DeliveryService,
  ) {}

  private get client(): Prisma.TransactionClient {
    return this.tenantDb.client;
  }

  async create(
    tenantId: string,
    actorId: string | undefined,
    input: CreateCampaignInput,
  ) {
    const campaign = await this.client.campaign.create({
      data: {
        id: randomUUID(),
        tenantId,
        name: input.name,
        channel: input.channel,
        category: input.category ?? 'marketing',
        templateId: null,
        audience: (input.audience ?? undefined) as
          | Prisma.InputJsonValue
          | undefined,
        createdBy: actorId ?? null,
      },
    });
    await this.audit.write({
      tenantId,
      eventType: AUDIT_EVENT.DATA_CHANGE,
      action: 'communication.campaign.create',
      resource: 'campaign',
      resourceId: campaign.id,
      actorId: actorId ?? null,
      description: `campaign ${input.name} (${input.channel})`,
      metadata: { channel: input.channel, category: campaign.category },
    });
    return campaign;
  }

  async send(
    tenantId: string,
    actorId: string | undefined,
    campaignId: string,
    input: SendCampaignInput,
  ) {
    const campaign = await this.client.campaign.findFirst({
      where: { id: campaignId, tenantId },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');

    await this.client.campaign.update({
      where: { id: campaignId },
      data: { status: 'sending', startedAt: new Date() },
    });

    const channel = campaign.channel as DeliveryChannel;
    const category = campaign.category as DeliveryCategory;
    let sent = 0;
    let failed = 0;
    let suppressed = 0;

    for (const personId of input.recipientPersonIds) {
      const result = await this.delivery.send({
        tenantId,
        channel,
        category,
        personId,
        campaignId,
        actorId,
        subject: input.subject,
        body: input.body,
        variables: input.variables,
        // one attempt per (campaign, person) even if send() is retried
        dedupeKey: `campaign:${campaignId}:${personId}`,
      });

      const recipientStatus =
        result.status === 'suppressed'
          ? 'suppressed'
          : result.status === 'failed'
            ? 'failed'
            : 'sent';
      if (recipientStatus === 'sent') sent++;
      else if (recipientStatus === 'suppressed') suppressed++;
      else failed++;

      await this.client.campaignRecipient.upsert({
        where: { campaignId_personId: { campaignId, personId } },
        create: {
          id: randomUUID(),
          tenantId,
          campaignId,
          personId,
          status: recipientStatus,
          suppressReason: result.failureClass ?? null,
          deliveryAttemptId: result.attemptId,
        },
        update: {
          status: recipientStatus,
          suppressReason: result.failureClass ?? null,
          deliveryAttemptId: result.attemptId,
        },
      });
    }

    const updated = await this.client.campaign.update({
      where: { id: campaignId },
      data: {
        status: 'sent',
        finishedAt: new Date(),
        totalRecipients: input.recipientPersonIds.length,
        sentCount: sent,
        failedCount: failed,
        suppressedCount: suppressed,
      },
    });

    await this.audit.write({
      tenantId,
      eventType: AUDIT_EVENT.DATA_CHANGE,
      action: 'communication.campaign.send',
      resource: 'campaign',
      resourceId: campaignId,
      actorId: actorId ?? null,
      description: `campaign sent: ${sent} sent / ${suppressed} suppressed / ${failed} failed`,
      metadata: { sent, suppressed, failed },
    });
    return updated;
  }
}
