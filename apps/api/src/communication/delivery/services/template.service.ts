import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@workspace/database';

import { TenantDbService } from '../../../common/database/tenant-db.service';
import { AuditService } from '../../../common/audit/audit.service';
import { AUDIT_EVENT } from '../../../common/audit/audit.constants';
import type { DeliveryChannel } from '../delivery.types';

/**
 * Message templates + versions. A template is a stable per-tenant key; each
 * version pins the copy for a (channel, locale), so a notice always references
 * the exact text that was sent. Rendering resolves the highest *published*
 * version and interpolates {{placeholders}}.
 */
@Injectable()
export class TemplateService {
  constructor(
    private readonly tenantDb: TenantDbService,
    private readonly audit: AuditService,
  ) {}

  private get client(): Prisma.TransactionClient {
    return this.tenantDb.client;
  }

  async render(
    tenantId: string,
    key: string,
    channel: DeliveryChannel,
    locale: string,
    variables: Record<string, unknown>,
  ): Promise<{ subject?: string; body: string; versionId: string }> {
    const template = await this.client.messageTemplate.findFirst({
      where: { tenantId, key, isActive: true },
      select: { id: true },
    });
    if (!template) {
      throw new NotFoundException(`No active template '${key}'`);
    }
    const version = await this.client.templateVersion.findFirst({
      where: { templateId: template.id, channel, locale, status: 'published' },
      orderBy: { version: 'desc' },
    });
    const fallback =
      version ??
      (await this.client.templateVersion.findFirst({
        where: { templateId: template.id, channel, status: 'published' },
        orderBy: { version: 'desc' },
      }));
    if (!fallback) {
      throw new NotFoundException(
        `Template '${key}' has no published ${channel} version`,
      );
    }
    return {
      subject: fallback.subject
        ? interpolate(fallback.subject, variables)
        : undefined,
      body: interpolate(fallback.body, variables),
      versionId: fallback.id,
    };
  }

  async listTemplates(tenantId: string) {
    return this.client.messageTemplate.findMany({
      where: { tenantId },
      orderBy: { key: 'asc' },
      include: { versions: { orderBy: { version: 'desc' } } },
    });
  }

  async createTemplate(
    tenantId: string,
    actorId: string | undefined,
    input: {
      key: string;
      name: string;
      category?: string;
      description?: string;
    },
  ) {
    const template = await this.client.messageTemplate.create({
      data: {
        id: randomUUID(),
        tenantId,
        key: input.key,
        name: input.name,
        category: input.category ?? 'transactional',
        description: input.description ?? null,
        createdBy: actorId ?? null,
      },
    });
    await this.write(
      tenantId,
      actorId,
      'communication.template.create',
      template.id,
      {
        key: input.key,
      },
    );
    return template;
  }

  async addVersion(
    tenantId: string,
    actorId: string | undefined,
    templateId: string,
    input: {
      channel: DeliveryChannel;
      locale?: string;
      subject?: string;
      body: string;
      variables?: Record<string, unknown>;
      publish?: boolean;
    },
  ) {
    const template = await this.client.messageTemplate.findFirst({
      where: { id: templateId, tenantId },
      select: { id: true },
    });
    if (!template) throw new NotFoundException('Template not found');

    const locale = input.locale ?? 'en';
    const latest = await this.client.templateVersion.findFirst({
      where: { templateId, channel: input.channel, locale },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    const version = (latest?.version ?? 0) + 1;

    const created = await this.client.templateVersion.create({
      data: {
        id: randomUUID(),
        tenantId,
        templateId,
        version,
        channel: input.channel,
        locale,
        subject: input.subject ?? null,
        body: input.body,
        variables: (input.variables ?? undefined) as
          | Prisma.InputJsonValue
          | undefined,
        status: input.publish ? 'published' : 'draft',
        publishedAt: input.publish ? new Date() : null,
        createdBy: actorId ?? null,
      },
    });
    await this.write(
      tenantId,
      actorId,
      input.publish
        ? 'communication.template.publish'
        : 'communication.template.version',
      created.id,
      { templateId, channel: input.channel, version },
    );
    return created;
  }

  private write(
    tenantId: string,
    actorId: string | undefined,
    action: string,
    resourceId: string,
    metadata: Record<string, unknown>,
  ) {
    return this.audit.write({
      tenantId,
      eventType: AUDIT_EVENT.DATA_CHANGE,
      action,
      resource: 'message_template',
      resourceId,
      actorId: actorId ?? null,
      description: action,
      metadata,
    });
  }
}

/** Replace {{key}} placeholders; unknown keys become empty strings. */
function interpolate(
  template: string,
  variables: Record<string, unknown>,
): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key: string) => {
    const value = variables[key];
    return value == null ? '' : String(value);
  });
}
