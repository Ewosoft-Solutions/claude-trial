import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@workspace/database';

import { TenantDbService } from '../../common/database/tenant-db.service';
import { AuditService } from '../../common/audit/audit.service';
import { AUDIT_EVENT } from '../../common/audit/audit.constants';
import type { CreateSavedViewDto, UpdateSavedViewDto } from '../dto';

/**
 * Saved views for the F7 directory pattern.
 *
 * A SavedView persists a named, replayable snapshot of a list's URL state. It
 * is tenant-scoped (RLS) AND owner-scoped in this service: `list` returns the
 * caller's own views plus any the tenant has shared, while `update`/`remove`
 * require ownership — a shared view is readable by all, editable only by its
 * author. Views hold no record data, so this is a low-sensitivity convenience
 * layer; the real data governance lives in the projection service.
 */
@Injectable()
export class SavedViewService {
  constructor(
    private readonly tenantDb: TenantDbService,
    private readonly auditService: AuditService,
  ) {}

  private get client(): Prisma.TransactionClient {
    return this.tenantDb.client;
  }

  async list(tenantId: string, profileId: string, resource: string) {
    return this.client.savedView.findMany({
      where: {
        tenantId,
        resource,
        OR: [{ ownerUserTenantId: profileId }, { isShared: true }],
      },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
  }

  async create(
    tenantId: string,
    profileId: string,
    actorId: string | undefined,
    dto: CreateSavedViewDto,
  ) {
    if (dto.isDefault) {
      await this.clearDefault(tenantId, profileId, dto.resource);
    }
    const view = await this.client.savedView.create({
      data: {
        id: randomUUID(),
        tenantId,
        ownerUserTenantId: profileId,
        resource: dto.resource,
        name: dto.name,
        state: (dto.state ?? {}) as Prisma.InputJsonValue,
        isShared: dto.isShared ?? false,
        isDefault: dto.isDefault ?? false,
        createdBy: actorId ?? null,
      },
    });
    await this.audit(
      tenantId,
      actorId,
      'directory.saved_view.create',
      view.id,
      {
        resource: view.resource,
        isShared: view.isShared,
      },
    );
    return view;
  }

  async update(
    tenantId: string,
    profileId: string,
    actorId: string | undefined,
    id: string,
    dto: UpdateSavedViewDto,
  ) {
    const existing = await this.ownedOrThrow(tenantId, profileId, id);
    if (dto.isDefault) {
      await this.clearDefault(tenantId, profileId, existing.resource);
    }
    const view = await this.client.savedView.update({
      where: { id },
      data: {
        name: dto.name,
        state: dto.state as Prisma.InputJsonValue | undefined,
        isShared: dto.isShared,
        isDefault: dto.isDefault,
        updatedBy: actorId ?? null,
      },
    });
    await this.audit(tenantId, actorId, 'directory.saved_view.update', id, {});
    return view;
  }

  async remove(
    tenantId: string,
    profileId: string,
    actorId: string | undefined,
    id: string,
  ) {
    await this.ownedOrThrow(tenantId, profileId, id);
    await this.client.savedView.delete({ where: { id } });
    await this.audit(tenantId, actorId, 'directory.saved_view.delete', id, {});
    return { deleted: true };
  }

  /**
   * Load a view the caller owns, or throw. A view that exists but belongs to
   * another profile is Forbidden (not 404) so shared views can't be edited by
   * a viewer; a missing view is 404.
   */
  private async ownedOrThrow(tenantId: string, profileId: string, id: string) {
    const view = await this.client.savedView.findFirst({
      where: { id, tenantId },
    });
    if (!view) throw new NotFoundException('Saved view not found');
    if (view.ownerUserTenantId !== profileId) {
      throw new ForbiddenException('You can only change your own saved views');
    }
    return view;
  }

  /** Ensure at most one default per (owner, resource). */
  private async clearDefault(
    tenantId: string,
    profileId: string,
    resource: string,
  ) {
    await this.client.savedView.updateMany({
      where: {
        tenantId,
        ownerUserTenantId: profileId,
        resource,
        isDefault: true,
      },
      data: { isDefault: false },
    });
  }

  private async audit(
    tenantId: string,
    actorId: string | undefined,
    action: string,
    resourceId: string,
    metadata: Record<string, unknown>,
  ) {
    await this.auditService.write({
      tenantId,
      eventType: AUDIT_EVENT.DATA_CHANGE,
      action,
      resource: 'saved_view',
      resourceId,
      actorId: actorId ?? null,
      description: `${action} ${resourceId}`,
      metadata,
    });
  }
}
