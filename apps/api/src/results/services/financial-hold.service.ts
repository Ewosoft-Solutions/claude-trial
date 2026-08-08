/**
 * WB4 · FinancialHoldService — place or release an explicit, audited hold on a
 * student's result VISIBILITY to guardians (ADR-04 redesign of C112/#60). This
 * is the ONLY way finance can gate a result: a deliberate, logged decision, never
 * a silent per-student block. The published result itself is never altered — only
 * whether guardians can see it — and staff always see it.
 */
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@workspace/database';

import { TenantDbService } from '../../common/database/tenant-db.service';
import { AuditService } from '../../common/audit/audit.service';
import { AUDIT_EVENT } from '../../common/audit/audit.constants';
import { AccessScopeService } from '../../auth/services/access-scope.service';
import type { ResultActor } from './results.types';
import type { CreateFinancialHoldDto } from '../dto';

@Injectable()
export class FinancialHoldService {
  constructor(
    private readonly tenantDb: TenantDbService,
    private readonly audit: AuditService,
    private readonly accessScope: AccessScopeService,
  ) {}

  private get client(): Prisma.TransactionClient {
    return this.tenantDb.client;
  }

  async list(tenantId: string, actor: ResultActor, studentId?: string) {
    const campusId = this.scopedCampusId(actor.grantScope);
    return this.client.financialHold.findMany({
      where: {
        tenantId,
        ...(studentId ? { studentId } : {}),
        ...(campusId ? { campusId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async place(
    tenantId: string,
    actor: ResultActor,
    dto: CreateFinancialHoldDto,
  ) {
    const student = await this.client.student.findFirst({
      where: { id: dto.studentId, tenantId },
      select: { id: true },
    });
    if (!student) throw new NotFoundException('Student not found');
    if (dto.campusId) {
      const campus = await this.client.campus.findFirst({
        where: { id: dto.campusId, tenantId },
        select: { id: true },
      });
      if (!campus)
        throw new BadRequestException('Campus not found for this tenant.');
      this.accessScope.assertWithinScope(actor.grantScope, {
        campusId: dto.campusId,
      });
    }

    // Idempotent: one active hold per student.
    const existing = await this.client.financialHold.findFirst({
      where: { tenantId, studentId: dto.studentId, status: 'active' },
      select: { id: true },
    });
    if (existing) {
      throw new BadRequestException('This student already has an active hold.');
    }

    const hold = await this.client.financialHold.create({
      data: {
        tenantId,
        studentId: dto.studentId,
        campusId: dto.campusId ?? null,
        status: 'active',
        reason: dto.reason.trim(),
        placedBy: actor.userId,
      },
    });
    await this.audit.write({
      tenantId,
      eventType: AUDIT_EVENT.SECURITY_EVENT,
      action: 'academics.results.financial_hold.place',
      resource: 'financial_hold',
      resourceId: hold.id,
      actorId: actor.userId,
      description: `placed a result financial hold on student ${dto.studentId}`,
      metadata: { studentId: dto.studentId, reason: hold.reason },
    });
    return hold;
  }

  async release(
    tenantId: string,
    actor: ResultActor,
    holdId: string,
    reason?: string,
  ) {
    const hold = await this.client.financialHold.findFirst({
      where: { id: holdId, tenantId },
    });
    if (!hold) throw new NotFoundException('Financial hold not found');
    if (hold.status !== 'active') {
      throw new BadRequestException('This hold is not active.');
    }
    this.accessScope.assertWithinScope(actor.grantScope, {
      campusId: hold.campusId ?? undefined,
    });
    const updated = await this.client.financialHold.update({
      where: { id: holdId },
      data: {
        status: 'released',
        releasedBy: actor.userId,
        releasedAt: new Date(),
        releaseReason: reason?.trim() || null,
      },
    });
    await this.audit.write({
      tenantId,
      eventType: AUDIT_EVENT.SECURITY_EVENT,
      action: 'academics.results.financial_hold.release',
      resource: 'financial_hold',
      resourceId: holdId,
      actorId: actor.userId,
      description: `released the result financial hold on student ${hold.studentId}`,
      metadata: { studentId: hold.studentId, reason },
    });
    return updated;
  }

  private scopedCampusId(grantScope: ResultActor['grantScope']): string | null {
    if (!grantScope || grantScope.type !== 'campus') return null;
    if (!grantScope.value) {
      throw new ForbiddenException('A campus-scoped action needs a campus.');
    }
    return grantScope.value;
  }
}
