import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@workspace/database';

import { TenantDbService } from '../../common/database/tenant-db.service';
import { AuditService } from '../../common/audit/audit.service';
import { AUDIT_EVENT } from '../../common/audit/audit.constants';

export interface AdoptInput {
  versionId: string;
  entryCohort: string;
  campusId?: string;
  programme?: string;
  levelFrom?: string;
  levelTo?: string;
  effectiveFrom: string | Date;
  effectiveTo?: string | Date | null;
  status?: string;
}

/**
 * Curriculum adoption (F6 / ADR-03). A tenant/campus adopts a version for an
 * entry cohort, effective-dated — so Primary 1 can run the NERDC-2025 version
 * while Primary 4 still runs the prior version in the SAME campus during the
 * transition. `resolveForCohort` answers "which version governs cohort C on
 * date D" from the effective-dated adoptions.
 */
@Injectable()
export class CurriculumAdoptionService {
  constructor(
    private readonly tenantDb: TenantDbService,
    private readonly audit: AuditService,
  ) {}

  private get client(): Prisma.TransactionClient {
    return this.tenantDb.client;
  }

  async adopt(
    tenantId: string,
    actorId: string | undefined,
    input: AdoptInput,
  ) {
    // The version must be visible (own or shared national); RLS enforces that.
    const version = await this.client.curriculumVersion.findFirst({
      where: { id: input.versionId },
      select: { id: true },
    });
    if (!version) throw new NotFoundException('Curriculum version not found');

    const effectiveFrom = new Date(input.effectiveFrom);
    const status = input.status ?? 'active';

    // Supersede any prior OPEN-ENDED active adoption for the same cohort+campus,
    // closing it at the new one's start date — so `resolveForCohort` never has
    // two open-ended active adoptions to disambiguate for one cohort.
    if (status === 'active') {
      await this.client.curriculumAdoption.updateMany({
        where: {
          tenantId,
          entryCohort: input.entryCohort,
          campusId: input.campusId ?? null,
          status: 'active',
          effectiveTo: null,
        },
        data: { status: 'superseded', effectiveTo: effectiveFrom },
      });
    }

    const adoption = await this.client.curriculumAdoption.create({
      data: {
        id: randomUUID(),
        tenantId,
        campusId: input.campusId ?? null,
        programme: input.programme ?? null,
        versionId: input.versionId,
        entryCohort: input.entryCohort,
        levelFrom: input.levelFrom ?? null,
        levelTo: input.levelTo ?? null,
        effectiveFrom,
        effectiveTo: input.effectiveTo ? new Date(input.effectiveTo) : null,
        status,
        approvedBy: actorId ?? null,
        approvedAt: status === 'active' ? new Date() : null,
        createdBy: actorId ?? null,
      },
    });
    await this.audit.write({
      tenantId,
      eventType: AUDIT_EVENT.DATA_CHANGE,
      action: 'curriculum.adoption.create',
      resource: 'curriculum_adoption',
      resourceId: adoption.id,
      actorId: actorId ?? null,
      description: `adopt version ${input.versionId} for ${input.entryCohort}`,
      metadata: { entryCohort: input.entryCohort, versionId: input.versionId },
    });
    return adoption;
  }

  /**
   * The governing adoption for a cohort on a date: active, entry-cohort match,
   * within the effective window. Newest effective wins if several overlap.
   */
  async resolveForCohort(
    tenantId: string,
    entryCohort: string,
    campusId?: string,
    at?: string | Date,
  ) {
    const atDate = at ? new Date(at) : new Date();
    const adoption = await this.client.curriculumAdoption.findFirst({
      where: {
        tenantId,
        entryCohort,
        status: 'active',
        ...(campusId ? { campusId } : {}),
        effectiveFrom: { lte: atDate },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: atDate } }],
      },
      orderBy: { effectiveFrom: 'desc' },
    });
    if (!adoption) return null;
    const version = await this.client.curriculumVersion.findFirst({
      where: { id: adoption.versionId },
    });
    return { adoption, version };
  }

  listAdoptions(tenantId: string) {
    return this.client.curriculumAdoption.findMany({
      where: { tenantId },
      orderBy: [{ entryCohort: 'asc' }, { effectiveFrom: 'desc' }],
    });
  }
}
