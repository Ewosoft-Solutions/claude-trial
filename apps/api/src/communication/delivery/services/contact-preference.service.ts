import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@workspace/database';

import { TenantDbService } from '../../../common/database/tenant-db.service';
import { AuditService } from '../../../common/audit/audit.service';
import { AUDIT_EVENT } from '../../../common/audit/audit.constants';
import type { DeliveryChannel } from '../delivery.types';

export interface SetPreferenceInput {
  channel: DeliveryChannel;
  optedIn?: boolean;
  isDnd?: boolean;
  consentSource?: string;
  quietHoursStart?: number | null;
  quietHoursEnd?: number | null;
}

/**
 * Per-person, per-channel contact preferences (consent, DND, quiet hours). This
 * is the richer consent model that person.ContactPoint defers to. Consent is
 * evidence-bearing (source + timestamp) for NDPA lawful-basis checks; the
 * DeliveryService reads it to suppress non-critical sends to opted-out
 * recipients while still allowing critical notices.
 */
@Injectable()
export class ContactPreferenceService {
  constructor(
    private readonly tenantDb: TenantDbService,
    private readonly audit: AuditService,
  ) {}

  private get client(): Prisma.TransactionClient {
    return this.tenantDb.client;
  }

  list(tenantId: string, personId: string) {
    return this.client.contactPreference.findMany({
      where: { tenantId, personId },
      orderBy: { channel: 'asc' },
    });
  }

  async set(
    tenantId: string,
    personId: string,
    actorId: string | undefined,
    input: SetPreferenceInput,
  ) {
    const optedIn = input.optedIn ?? true;
    const pref = await this.client.contactPreference.upsert({
      where: { personId_channel: { personId, channel: input.channel } },
      create: {
        id: randomUUID(),
        tenantId,
        personId,
        channel: input.channel,
        optedIn,
        isDnd: input.isDnd ?? false,
        consentSource: input.consentSource ?? null,
        consentAt: new Date(),
        quietHoursStart: input.quietHoursStart ?? null,
        quietHoursEnd: input.quietHoursEnd ?? null,
        updatedBy: actorId ?? null,
      },
      update: {
        optedIn: input.optedIn ?? undefined,
        isDnd: input.isDnd ?? undefined,
        consentSource: input.consentSource ?? undefined,
        consentAt: input.optedIn === undefined ? undefined : new Date(),
        quietHoursStart:
          input.quietHoursStart === undefined
            ? undefined
            : input.quietHoursStart,
        quietHoursEnd:
          input.quietHoursEnd === undefined ? undefined : input.quietHoursEnd,
        updatedBy: actorId ?? null,
      },
    });

    await this.audit.write({
      tenantId,
      eventType: AUDIT_EVENT.DATA_CHANGE,
      action: 'communication.preference.set',
      resource: 'contact_preference',
      resourceId: pref.id,
      actorId: actorId ?? null,
      description: `${input.channel} optedIn=${pref.optedIn} dnd=${pref.isDnd}`,
      metadata: {
        personId,
        channel: input.channel,
        optedIn: pref.optedIn,
        isDnd: pref.isDnd,
        consentSource: pref.consentSource,
      },
    });
    return pref;
  }
}
