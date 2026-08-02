import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@workspace/database';

import { TenantDbService } from '../../common/database/tenant-db.service';
import { AuditService } from '../../common/audit/audit.service';
import { AUDIT_EVENT } from '../../common/audit/audit.constants';

export interface CreateOverlayInput {
  baseVersionId: string;
  changeType: string;
  targetType?: string;
  targetId?: string;
  payload?: Record<string, unknown>;
  note?: string;
}

/**
 * Tenant curriculum overlays (F6 / ADR-03): a tenant's approved delta LAYERED
 * over an immutable national version. The base version is never mutated — this
 * is how a tenant customizes national content (add a subject, rename, hide a
 * node) while the source stays reproducible.
 */
@Injectable()
export class CurriculumOverlayService {
  constructor(
    private readonly tenantDb: TenantDbService,
    private readonly audit: AuditService,
  ) {}

  private get client(): Prisma.TransactionClient {
    return this.tenantDb.client;
  }

  async create(
    tenantId: string,
    actorId: string | undefined,
    input: CreateOverlayInput,
  ) {
    const base = await this.client.curriculumVersion.findFirst({
      where: { id: input.baseVersionId },
      select: { id: true },
    });
    if (!base) throw new NotFoundException('Base version not found');
    const overlay = await this.client.tenantCurriculumOverlay.create({
      data: {
        id: randomUUID(),
        tenantId,
        baseVersionId: input.baseVersionId,
        changeType: input.changeType,
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
        payload: (input.payload ?? undefined) as
          | Prisma.InputJsonValue
          | undefined,
        note: input.note ?? null,
        createdBy: actorId ?? null,
      },
    });
    await this.write(
      tenantId,
      actorId,
      'curriculum.overlay.create',
      overlay.id,
      {
        baseVersionId: input.baseVersionId,
        changeType: input.changeType,
      },
    );
    return overlay;
  }

  async approve(tenantId: string, actorId: string | undefined, id: string) {
    const overlay = await this.client.tenantCurriculumOverlay.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });
    if (!overlay) throw new NotFoundException('Overlay not found');
    const updated = await this.client.tenantCurriculumOverlay.update({
      where: { id },
      data: {
        status: 'active',
        approvedBy: actorId ?? null,
        approvedAt: new Date(),
      },
    });
    await this.write(tenantId, actorId, 'curriculum.overlay.approve', id, {});
    return updated;
  }

  list(tenantId: string, baseVersionId?: string) {
    return this.client.tenantCurriculumOverlay.findMany({
      where: { tenantId, ...(baseVersionId ? { baseVersionId } : {}) },
      orderBy: { createdAt: 'desc' },
    });
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
      resource: 'curriculum_overlay',
      resourceId,
      actorId: actorId ?? null,
      description: action,
      metadata,
    });
  }
}
