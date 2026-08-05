/**
 * Campus service (WB1-6)
 *
 * Minimal CRUD over `tenant.campuses` — the operating units WITHIN a tenant
 * (ADR-11 Option A) that an access grant is scoped to. Runs on the request's
 * tenant-scoped client (RLS-backed; no privileged client) inside a
 * `@TenantScoped` request. WB2 (academic structure) grows classes/arms that
 * reference a campus; WB5 (finance) tags charges/exports with one.
 */
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@workspace/database';

import { TenantDbService } from '../../common/database/tenant-db.service';
import { AuditService } from '../../common/audit/audit.service';
import { AUDIT_EVENT } from '../../common/audit/audit.constants';
import {
  AccessScopeService,
  type ScopeDescriptor,
} from '../../auth/services/access-scope.service';
import type { CreateCampusDto, UpdateCampusDto } from '../dto/access.dto';

@Injectable()
export class CampusService {
  constructor(
    private readonly tenantDb: TenantDbService,
    private readonly audit: AuditService,
    private readonly accessScope: AccessScopeService,
  ) {}

  private get client(): Prisma.TransactionClient {
    return this.tenantDb.client;
  }

  /** Campuses for the tenant, primary first then by name. */
  list(tenantId: string) {
    return this.client.campus.findMany({
      where: { tenantId },
      orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        code: true,
        status: true,
        isPrimary: true,
        address: true,
      },
    });
  }

  /** Load one campus (tenant-scoped), or 404. */
  async get(tenantId: string, campusId: string) {
    const campus = await this.client.campus.findFirst({
      where: { id: campusId, tenantId },
    });
    if (!campus) throw new NotFoundException('Campus not found');
    return campus;
  }

  async create(
    tenantId: string,
    actorId: string,
    dto: CreateCampusDto,
    actorScope?: ScopeDescriptor | null,
  ) {
    // A campus-scoped admin has no campus to create within — only an unscoped
    // (whole-school) manager may add campuses. Reuses the grant-scope primitive.
    this.accessScope.assertWithinScope(actorScope, {});
    const code = dto.code.trim().toUpperCase();
    try {
      // The request already runs inside one RLS transaction (@TenantScoped), so
      // the demote-then-create pair is atomic without a nested $transaction
      // (which the scoped TransactionClient does not expose).
      if (dto.isPrimary) {
        await this.client.campus.updateMany({
          where: { tenantId, isPrimary: true },
          data: { isPrimary: false },
        });
      }
      const created = await this.client.campus.create({
        data: {
          tenantId,
          name: dto.name.trim(),
          code,
          address: dto.address?.trim() || null,
          isPrimary: dto.isPrimary ?? false,
          createdBy: actorId,
        },
      });

      await this.audit.write({
        tenantId,
        eventType: AUDIT_EVENT.DATA_CHANGE,
        action: 'campus.create',
        resource: 'campus',
        resourceId: created.id,
        actorId,
        description: `created campus ${created.name} (${created.code})`,
        metadata: { code: created.code, isPrimary: created.isPrimary },
      });
      return created;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          `A campus with code "${code}" already exists.`,
        );
      }
      throw error;
    }
  }

  async update(
    tenantId: string,
    actorId: string,
    campusId: string,
    dto: UpdateCampusDto,
    actorScope?: ScopeDescriptor | null,
  ) {
    await this.get(tenantId, campusId); // 404 if not this tenant's
    // A campus-scoped admin may only edit their own campus.
    this.accessScope.assertWithinScope(actorScope, { campusId });
    if (dto.isPrimary === true) {
      await this.client.campus.updateMany({
        where: { tenantId, isPrimary: true, id: { not: campusId } },
        data: { isPrimary: false },
      });
    }
    const updated = await this.client.campus.update({
      where: { id: campusId },
      data: {
        name: dto.name?.trim(),
        address:
          dto.address === undefined ? undefined : dto.address.trim() || null,
        status: dto.status,
        isPrimary: dto.isPrimary,
        updatedBy: actorId,
      },
    });

    await this.audit.write({
      tenantId,
      eventType: AUDIT_EVENT.DATA_CHANGE,
      action: 'campus.update',
      resource: 'campus',
      resourceId: campusId,
      actorId,
      description: `updated campus ${updated.name}`,
      metadata: { status: updated.status, isPrimary: updated.isPrimary },
    });
    return updated;
  }
}
