/**
 * Promotion service (WB2-4)
 *
 * Move a cohort to the next year in ONE reviewable operation:
 *
 *   1. createRun   — declare a from→to (academic year + year level) rollover.
 *   2. preview     — materialise a PromotionRunItem per active student in the
 *                    source cohort, each with a PROPOSED next-year section
 *                    (matched by stream + name in the target year level).
 *   3. setException — mark ONE student repeat / withhold / manual — changes only
 *                    that item (scenario 4).
 *   4. requestCommit — the commit is a high-risk bulk mutation, so it is routed
 *                    through the WB1-6 maker-checker: a `MakerCheckerRequest` is
 *                    raised and the run parks in 'pending_approval'.
 *   5. approveAndCommit — a SECOND approver (maker ≠ checker, Management+) signs
 *                    off; only then are NEXT-year SectionEnrollments + promotion
 *                    placement spans created. The PRIOR year is never touched.
 *
 * Runs on the request's tenant-scoped client (RLS; no privileged client) inside
 * a `@TenantScoped` transaction; campus-scoped via the WB1-6 `AccessScopeService`.
 */
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, PrismaClient } from '@workspace/database';

import { TenantDbService } from '../../common/database/tenant-db.service';
import { AuditService } from '../../common/audit/audit.service';
import { AUDIT_EVENT } from '../../common/audit/audit.constants';
import { MakerCheckerService } from '../../auth/services/maker-checker.service';
import {
  AccessScopeService,
  type ScopeDescriptor,
} from '../../auth/services/access-scope.service';
import { StudentLifecycleService } from './student-lifecycle.service';
import type { CreatePromotionRunDto, SetPromotionExceptionDto } from '../dto';

/** Who is acting on a promotion run + their authority (for maker-checker). */
export interface PromotionActor {
  userId: string;
  clearanceLevel: number;
  grantScope?: ScopeDescriptor | null;
}

export const PROMOTION_COMMIT_OP = 'academics.promotion.commit';

/**
 * Where a promotion item is to be placed: its proposed section, except a
 * 'repeat' falls back to the student's SOURCE section (they stay at the same
 * level next year). A pure decision — unit-tested. Returns null when there is no
 * target to place into.
 */
export function resolveTargetSection(item: {
  decision: string;
  proposedClassSectionId: string | null;
  fromClassSectionId: string | null;
}): string | null {
  if (item.decision === 'repeat') {
    return item.proposedClassSectionId ?? item.fromClassSectionId;
  }
  return item.proposedClassSectionId;
}

@Injectable()
export class PromotionService {
  constructor(
    private readonly tenantDb: TenantDbService,
    private readonly audit: AuditService,
    private readonly accessScope: AccessScopeService,
    private readonly makerChecker: MakerCheckerService,
    private readonly lifecycle: StudentLifecycleService,
  ) {}

  private get client(): Prisma.TransactionClient {
    return this.tenantDb.client;
  }

  /** MakerCheckerService is typed for the full client; the scoped tx satisfies it. */
  private get prisma(): PrismaClient {
    return this.tenantDb.client as unknown as PrismaClient;
  }

  private async writeAudit(
    tenantId: string,
    actorId: string,
    action: string,
    resourceId: string,
    description: string,
    metadata?: Record<string, unknown>,
  ) {
    await this.audit.write({
      tenantId,
      eventType: AUDIT_EVENT.DATA_CHANGE,
      action,
      resource: 'promotion_run',
      resourceId,
      actorId,
      description,
      metadata,
    });
  }

  // ======================= create =======================

  async createRun(
    tenantId: string,
    actor: PromotionActor,
    dto: CreatePromotionRunDto,
  ) {
    if (dto.campusId) {
      await this.assertCampus(tenantId, dto.campusId);
      this.accessScope.assertWithinScope(actor.grantScope, {
        campusId: dto.campusId,
      });
    }
    await Promise.all([
      this.assertAcademicYear(tenantId, dto.fromAcademicYearId),
      this.assertAcademicYear(tenantId, dto.toAcademicYearId),
      this.assertYearLevel(tenantId, dto.fromYearLevelId),
      this.assertYearLevel(tenantId, dto.toYearLevelId),
    ]);
    if (dto.fromAcademicYearId === dto.toAcademicYearId) {
      throw new BadRequestException(
        'The promotion source and destination academic years must differ.',
      );
    }

    const run = await this.client.promotionRun.create({
      data: {
        tenantId,
        campusId: dto.campusId ?? null,
        name: dto.name.trim(),
        fromAcademicYearId: dto.fromAcademicYearId,
        toAcademicYearId: dto.toAcademicYearId,
        fromYearLevelId: dto.fromYearLevelId,
        toYearLevelId: dto.toYearLevelId,
        status: 'draft',
        createdBy: actor.userId,
      },
    });
    await this.writeAudit(
      tenantId,
      actor.userId,
      'academics.promotion.create',
      run.id,
      `created promotion run ${run.name}`,
    );
    return run;
  }

  async listRuns(tenantId: string, actor: PromotionActor) {
    // A campus-scoped viewer only sees their own campus's runs (the read-path
    // twin of assertRunScope, which denies a campus-scoped actor a tenant-wide
    // run) — mirrors the WB2-1 read clamp. Unscoped/global sees everything.
    const campusId = this.scopedCampusId(actor.grantScope);
    return this.client.promotionRun.findMany({
      where: { tenantId, ...(campusId ? { campusId } : {}) },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getRun(tenantId: string, actor: PromotionActor, runId: string) {
    const run = await this.loadRun(tenantId, runId);
    this.assertRunScope(actor, run);
    const items = await this.loadItemsWithLabels(tenantId, runId);
    return { run, items };
  }

  // ======================= preview =======================

  /**
   * Build the proposed cohort for the run: every student with an ACTIVE section
   * enrollment in a source-year-level section (for the source academic year,
   * within the run's campus). Each gets a proposed target section in the target
   * year level, matched by (stream, name); an unmatched student needs a manual
   * placement. Re-previewing a not-yet-committed run rebuilds the items.
   */
  async preview(tenantId: string, actor: PromotionActor, runId: string) {
    const run = await this.loadRun(tenantId, runId);
    this.assertRunScope(actor, run);
    if (run.status === 'committed') {
      throw new BadRequestException('This run is already committed.');
    }
    if (run.status === 'pending_approval') {
      throw new BadRequestException(
        'This run is awaiting approval; cancel it before re-previewing.',
      );
    }
    if (run.status === 'cancelled') {
      throw new BadRequestException('This run was cancelled.');
    }

    // Source sections: the run's from-year-level sections (optionally campus).
    const sourceSections = await this.client.classSection.findMany({
      where: {
        tenantId,
        yearLevelId: run.fromYearLevelId,
        ...(run.campusId ? { campusId: run.campusId } : {}),
      },
      select: { id: true, streamId: true, name: true, campusId: true },
    });
    const sourceSectionIds = sourceSections.map((s) => s.id);
    const sourceById = new Map(sourceSections.map((s) => [s.id, s]));

    // Target sections in the destination year level (same campus scope).
    const targetSections = await this.client.classSection.findMany({
      where: {
        tenantId,
        yearLevelId: run.toYearLevelId,
        status: 'active',
        ...(run.campusId ? { campusId: run.campusId } : {}),
      },
      select: { id: true, streamId: true, name: true, campusId: true },
    });
    // Match a source section to a target by (stream, name), then by stream, then
    // (if a single target exists) that one — else no automatic proposal.
    const proposeTarget = (source: {
      streamId: string | null;
      name: string;
      campusId: string;
    }): string | null => {
      const sameCampus = targetSections.filter(
        (t) => t.campusId === source.campusId,
      );
      const byStreamAndName = sameCampus.find(
        (t) => t.streamId === source.streamId && t.name === source.name,
      );
      if (byStreamAndName) return byStreamAndName.id;
      const byStream = sameCampus.find((t) => t.streamId === source.streamId);
      if (byStream) return byStream.id;
      return sameCampus.length === 1 ? sameCampus[0]!.id : null;
    };

    const cohort = sourceSectionIds.length
      ? await this.client.sectionEnrollment.findMany({
          where: {
            tenantId,
            status: 'active',
            classSectionId: { in: sourceSectionIds },
            academicYearId: run.fromAcademicYearId,
          },
          select: { studentId: true, classSectionId: true, enrolledAt: true },
          // Deterministic: for a student with >1 active source enrollment, the
          // earliest wins consistently (rather than arbitrary row order).
          orderBy: [{ enrolledAt: 'asc' }, { id: 'asc' }],
        })
      : [];

    // Rebuild items for a not-yet-committed run (idempotent preview).
    await this.client.promotionRunItem.deleteMany({
      where: { tenantId, runId },
    });
    // De-dupe students (a student should appear once even with >1 enrollment).
    const seen = new Set<string>();
    const itemsData: Prisma.PromotionRunItemCreateManyInput[] = [];
    for (const row of cohort) {
      if (seen.has(row.studentId)) continue;
      seen.add(row.studentId);
      const source = sourceById.get(row.classSectionId);
      const proposed = source ? proposeTarget(source) : null;
      itemsData.push({
        tenantId,
        runId,
        studentId: row.studentId,
        fromClassSectionId: row.classSectionId,
        proposedClassSectionId: proposed,
        decision: 'promote',
        status: 'pending',
        createdBy: actor.userId,
      });
    }
    if (itemsData.length) {
      await this.client.promotionRunItem.createMany({ data: itemsData });
    }

    const updated = await this.client.promotionRun.update({
      where: { id: runId },
      data: {
        status: 'previewed',
        previewedAt: new Date(),
        updatedBy: actor.userId,
      },
    });
    await this.writeAudit(
      tenantId,
      actor.userId,
      'academics.promotion.preview',
      runId,
      `previewed promotion run ${run.name}: ${itemsData.length} students`,
      { cohortSize: itemsData.length },
    );
    const items = await this.loadItemsWithLabels(tenantId, runId);
    return { run: updated, items };
  }

  // ======================= exceptions =======================

  /** Mark ONE student an exception — changes only that item (scenario 4). */
  async setException(
    tenantId: string,
    actor: PromotionActor,
    runId: string,
    itemId: string,
    dto: SetPromotionExceptionDto,
  ) {
    const run = await this.loadRun(tenantId, runId);
    this.assertRunScope(actor, run);
    if (run.status !== 'previewed') {
      throw new BadRequestException(
        'Exceptions can only be set on a previewed run before commit.',
      );
    }
    const item = await this.client.promotionRunItem.findFirst({
      where: { id: itemId, runId, tenantId },
      select: { id: true },
    });
    if (!item) throw new NotFoundException('Promotion item not found');

    const proposed = dto.proposedClassSectionId?.trim() || undefined;
    if (dto.decision === 'manual' && !proposed) {
      throw new BadRequestException(
        'A manual placement needs a destination section.',
      );
    }
    // A chosen destination must exist, be within the actor's campus scope, and —
    // when the run is campus-scoped — belong to that campus (so a manual
    // exception can't place a student on another campus). This closes the
    // scope-escape the auto-proposal path already prevents.
    if (proposed) {
      const section = await this.client.classSection.findFirst({
        where: { id: proposed, tenantId },
        select: { id: true, campusId: true },
      });
      if (!section) {
        throw new BadRequestException(
          'Destination section not found for this tenant.',
        );
      }
      this.accessScope.assertWithinScope(actor.grantScope, {
        campusId: section.campusId,
      });
      if (run.campusId && section.campusId !== run.campusId) {
        throw new BadRequestException(
          'The destination section is on a different campus than this run.',
        );
      }
    }

    // The section stored for each decision:
    //   • withhold → null (the student is held back, no next-year placement).
    //   • repeat   → the explicit choice, else null so the commit resolver falls
    //                back to the student's SOURCE section (they repeat the level).
    //                Without this, repeat silently kept the preview's next-level
    //                proposal and PROMOTED the student.
    //   • promote/manual → the explicit choice, else keep the existing proposal.
    let proposedUpdate: string | null | undefined;
    if (dto.decision === 'withhold') {
      proposedUpdate = null;
    } else if (dto.decision === 'repeat') {
      proposedUpdate = proposed ?? null;
    } else {
      proposedUpdate = proposed ?? undefined;
    }

    const updated = await this.client.promotionRunItem.update({
      where: { id: itemId },
      data: {
        decision: dto.decision,
        proposedClassSectionId: proposedUpdate,
        exceptionReason: dto.reason?.trim() || null,
        updatedBy: actor.userId,
      },
    });
    await this.writeAudit(
      tenantId,
      actor.userId,
      'academics.promotion.exception',
      runId,
      `set ${dto.decision} on student ${updated.studentId}`,
      { itemId, decision: dto.decision },
    );
    return updated;
  }

  // ======================= request commit (maker-checker) =======================

  /** Raise the maker-checker request; the run parks in 'pending_approval'. */
  async requestCommit(tenantId: string, actor: PromotionActor, runId: string) {
    const run = await this.loadRun(tenantId, runId);
    this.assertRunScope(actor, run);
    if (run.status !== 'previewed') {
      throw new BadRequestException(
        'Only a previewed run can be submitted for approval.',
      );
    }
    const pending = await this.client.promotionRunItem.count({
      where: { tenantId, runId, status: 'pending' },
    });
    if (pending === 0) {
      throw new BadRequestException(
        'This run has no students to promote. Preview it first.',
      );
    }

    const approvalRequestId = await this.makerChecker.createApprovalRequest(
      this.prisma,
      PROMOTION_COMMIT_OP,
      actor.userId,
      actor.clearanceLevel,
      { runId } as unknown as Prisma.InputJsonValue,
      tenantId,
    );
    const updated = await this.client.promotionRun.update({
      where: { id: runId },
      data: {
        status: 'pending_approval',
        approvalRequestId,
        updatedBy: actor.userId,
      },
    });
    await this.writeAudit(
      tenantId,
      actor.userId,
      'academics.promotion.request_commit',
      runId,
      `submitted promotion run ${run.name} for approval (${pending} students)`,
      { approvalRequestId, pending },
    );
    return {
      status: 'pending_approval' as const,
      approvalRequestId,
      run: updated,
    };
  }

  // ======================= approve + commit =======================

  /**
   * A second approver signs off the maker-checker request, then the commit runs:
   * next-year SectionEnrollments + promotion spans are created for every
   * promote/manual/repeat item; withheld students get nothing. The PRIOR year is
   * never touched.
   */
  async approveAndCommit(
    tenantId: string,
    checker: PromotionActor,
    runId: string,
    reason?: string,
  ) {
    const run = await this.loadRun(tenantId, runId);
    this.assertRunScope(checker, run);
    if (run.status !== 'pending_approval' || !run.approvalRequestId) {
      throw new BadRequestException('This run is not awaiting approval.');
    }

    // Separation of duties + clearance floor enforced by MakerCheckerService:
    // the maker can never approve their own request.
    const result = await this.makerChecker.approveRequest(
      this.prisma,
      run.approvalRequestId,
      checker.userId,
      checker.clearanceLevel,
      reason,
    );
    if (!result.approved) {
      throw new ForbiddenException(result.error ?? 'Approval failed');
    }

    const toYear = await this.client.academicYear.findFirst({
      where: { id: run.toAcademicYearId, tenantId },
      select: { id: true, startDate: true },
    });
    if (!toYear) {
      throw new BadRequestException('Destination academic year not found.');
    }
    const effectiveFrom = toYear.startDate ?? new Date();

    const items = await this.client.promotionRunItem.findMany({
      where: { tenantId, runId, status: 'pending' },
    });
    // Resolve the campus for each proposed target section once.
    const targetIds = [
      ...new Set(
        items
          .map((i) => this.resolveTargetSection(i))
          .filter((id): id is string => !!id),
      ),
    ];
    const targetSections = targetIds.length
      ? await this.client.classSection.findMany({
          where: { id: { in: targetIds }, tenantId },
          select: { id: true, campusId: true },
        })
      : [];
    const campusOf = new Map(targetSections.map((s) => [s.id, s.campusId]));

    let committed = 0;
    let withheld = 0;
    let skipped = 0;
    for (const item of items) {
      if (item.decision === 'withhold') {
        await this.client.promotionRunItem.update({
          where: { id: item.id },
          data: { status: 'skipped', updatedBy: checker.userId },
        });
        withheld += 1;
        continue;
      }
      const targetSectionId = this.resolveTargetSection(item);
      const campusId = targetSectionId ? campusOf.get(targetSectionId) : null;
      if (!targetSectionId || !campusId) {
        // No target to place into (e.g. an unmatched promote with no proposal).
        await this.client.promotionRunItem.update({
          where: { id: item.id },
          data: { status: 'skipped', updatedBy: checker.userId },
        });
        skipped += 1;
        continue;
      }
      const placement = await this.lifecycle.recordPromotionPlacement(
        tenantId,
        checker.userId,
        {
          studentId: item.studentId,
          classSectionId: targetSectionId,
          campusId,
          academicYearId: run.toAcademicYearId,
          effectiveFrom,
          reason: item.exceptionReason,
        },
      );
      await this.client.promotionRunItem.update({
        where: { id: item.id },
        data: {
          status: 'committed',
          resultingEnrollmentId: placement.enrollmentId,
          updatedBy: checker.userId,
        },
      });
      committed += 1;
    }

    const updated = await this.client.promotionRun.update({
      where: { id: runId },
      data: {
        status: 'committed',
        committedAt: new Date(),
        committedBy: checker.userId,
        updatedBy: checker.userId,
      },
    });
    await this.writeAudit(
      tenantId,
      checker.userId,
      'academics.promotion.commit',
      runId,
      `committed promotion run ${run.name}: ${committed} promoted, ${withheld} withheld, ${skipped} skipped`,
      {
        committed,
        withheld,
        skipped,
        approvalRequestId: run.approvalRequestId,
      },
    );
    return {
      status: 'committed' as const,
      committed,
      withheld,
      skipped,
      run: updated,
    };
  }

  // ======================= cancel =======================

  /**
   * Cancel a run before it commits — the escape hatch for a mistaken run or a
   * pending approval that should be withdrawn. Rejects any pending maker-checker
   * request (so it isn't stranded) and moves the run to 'cancelled'. A committed
   * run is immutable and cannot be cancelled.
   */
  async cancelRun(
    tenantId: string,
    actor: PromotionActor,
    runId: string,
    reason?: string,
  ) {
    const run = await this.loadRun(tenantId, runId);
    this.assertRunScope(actor, run);
    if (run.status === 'committed') {
      throw new BadRequestException('A committed run cannot be cancelled.');
    }
    if (run.status === 'cancelled') {
      throw new BadRequestException('This run is already cancelled.');
    }
    if (run.status === 'pending_approval' && run.approvalRequestId) {
      // Withdraw the pending maker-checker request so it isn't left dangling.
      await this.makerChecker.rejectRequest(
        this.prisma,
        run.approvalRequestId,
        actor.userId,
        reason?.trim() || 'Promotion run cancelled',
      );
    }
    const updated = await this.client.promotionRun.update({
      where: { id: runId },
      data: {
        status: 'cancelled',
        approvalRequestId: null,
        updatedBy: actor.userId,
      },
    });
    await this.writeAudit(
      tenantId,
      actor.userId,
      'academics.promotion.cancel',
      runId,
      `cancelled promotion run ${run.name}`,
      { previousStatus: run.status },
    );
    return { status: 'cancelled' as const, run: updated };
  }

  // ======================= internals =======================

  /** Where an item is to be placed (delegates to the pure `resolveTargetSection`). */
  private resolveTargetSection(item: {
    decision: string;
    proposedClassSectionId: string | null;
    fromClassSectionId: string | null;
  }): string | null {
    return resolveTargetSection(item);
  }

  private assertRunScope(
    actor: PromotionActor,
    run: { campusId: string | null },
  ) {
    this.accessScope.assertWithinScope(actor.grantScope, {
      campusId: run.campusId ?? undefined,
    });
  }

  /**
   * The campus a scoped READ is clamped to, or null when unrestricted. A
   * `campus`-scoped actor only ever sees their own campus's rows; an
   * unscoped/`global` scope is unclamped. A `campus` scope with no campus fails
   * CLOSED (denied) — same rule as AccessScopeService's write path.
   */
  private scopedCampusId(
    grantScope: PromotionActor['grantScope'],
  ): string | null {
    if (!grantScope || grantScope.type !== 'campus') return null;
    if (!grantScope.value) {
      throw new ForbiddenException('A campus-scoped action needs a campus.');
    }
    return grantScope.value;
  }

  private async loadRun(tenantId: string, runId: string) {
    const run = await this.client.promotionRun.findFirst({
      where: { id: runId, tenantId },
    });
    if (!run) throw new NotFoundException('Promotion run not found');
    return run;
  }

  /** Items enriched with student number + source/proposed section labels. */
  private async loadItemsWithLabels(tenantId: string, runId: string) {
    const items = await this.client.promotionRunItem.findMany({
      where: { tenantId, runId },
      orderBy: { createdAt: 'asc' },
    });
    const studentIds = [...new Set(items.map((i) => i.studentId))];
    const sectionIds = [
      ...new Set(
        items
          .flatMap((i) => [i.fromClassSectionId, i.proposedClassSectionId])
          .filter((id): id is string => !!id),
      ),
    ];
    const [students, sections] = await Promise.all([
      studentIds.length
        ? this.client.student.findMany({
            where: { id: { in: studentIds }, tenantId },
            select: { id: true, studentNumber: true },
          })
        : Promise.resolve([]),
      sectionIds.length
        ? this.client.classSection.findMany({
            where: { id: { in: sectionIds }, tenantId },
            select: { id: true, displayLabel: true },
          })
        : Promise.resolve([]),
    ]);
    const numberOf = new Map(students.map((s) => [s.id, s.studentNumber]));
    const labelOf = new Map(sections.map((s) => [s.id, s.displayLabel]));
    return items.map((i) => ({
      id: i.id,
      studentId: i.studentId,
      studentNumber: numberOf.get(i.studentId) ?? null,
      fromClassSectionId: i.fromClassSectionId,
      fromSectionLabel: i.fromClassSectionId
        ? (labelOf.get(i.fromClassSectionId) ?? null)
        : null,
      proposedClassSectionId: i.proposedClassSectionId,
      proposedSectionLabel: i.proposedClassSectionId
        ? (labelOf.get(i.proposedClassSectionId) ?? null)
        : null,
      decision: i.decision,
      status: i.status,
      exceptionReason: i.exceptionReason,
      resultingEnrollmentId: i.resultingEnrollmentId,
    }));
  }

  private async assertCampus(tenantId: string, campusId: string) {
    const campus = await this.client.campus.findFirst({
      where: { id: campusId, tenantId },
      select: { id: true },
    });
    if (!campus)
      throw new BadRequestException('Campus not found for this tenant.');
  }

  private async assertAcademicYear(tenantId: string, academicYearId: string) {
    const year = await this.client.academicYear.findFirst({
      where: { id: academicYearId, tenantId },
      select: { id: true },
    });
    if (!year)
      throw new BadRequestException('Academic year not found for this tenant.');
  }

  private async assertYearLevel(tenantId: string, yearLevelId: string) {
    const yl = await this.client.yearLevel.findFirst({
      where: { id: yearLevelId, tenantId },
      select: { id: true },
    });
    if (!yl)
      throw new BadRequestException('Year level not found for this tenant.');
  }
}
