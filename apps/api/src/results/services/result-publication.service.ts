/**
 * WB4 · ResultPublicationService — the publish + amend engine (ADR-04).
 *
 *   requestPublish   — the maker submits a complete, moderated cycle; a
 *                      maker-checker request is raised and the cycle parks in
 *                      'pending_approval'.
 *   approveAndPublish— a SECOND approver (maker ≠ checker) signs off; the cycle
 *                      is computed into an IMMUTABLE ResultPublication snapshot +
 *                      PublishedStudentResult rows, checksum-addressed, with a
 *                      report card per student + a broadsheet per section rendered
 *                      as DocumentArtifacts (ADR-08) and, if a signing authority
 *                      exists, a SignatureUse. Guardians are notified via F5.
 *   requestAmendment / approveAmendment — a post-publication correction (maker-
 *                      checker) updates the underlying entries and republishes a
 *                      NEW version, superseding the prior one. The original
 *                      snapshot is never overwritten.
 *
 * An absent learner is never zeroed; finance never silently blocks a result
 * (visibility is gated only by an explicit, audited FinancialHold).
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
import { SignatureService } from '../../documents/services/signature.service';
import { DeliveryService } from '../../communication/delivery/services/delivery.service';
import { ResultCycleService } from './result-cycle.service';
import {
  ResultArtifactService,
  type ArtifactStudent,
} from './result-artifact.service';
import {
  computeOverall,
  computeSubjectResult,
  recommendPromotion,
  resolveGrade,
  resolveRemark,
  type ComponentLite,
  type EntryLite,
  type GradeScale,
  type PromotionPolicy,
  type RemarkRuleLite,
} from './result-grading';
import { checksumOf } from './result-checksum';
import {
  RESULT_AMEND_OP,
  RESULT_PUBLISH_OP,
  type ResultActor,
} from './results.types';
import type { CreateAmendmentDto } from '../dto';

interface SnapshotSubject {
  subjectOfferingId: string;
  subjectLabel: string;
  components: {
    key: string;
    label: string;
    score: number | null;
    max: number;
    isAbsent: boolean;
    isExempt: boolean;
  }[];
  total: number | null;
  maxTotal: number | null;
  percentage: number | null;
  letterGrade: string | null;
  gradePoints: number | null;
  remark: string | null;
}
interface SnapshotStudent {
  studentId: string;
  studentNumber: string | null;
  studentName: string | null;
  classSectionId: string | null;
  sectionLabel: string | null;
  subjects: SnapshotSubject[];
  overallTotal: number | null;
  overallMax: number | null;
  average: number | null;
  overallGrade: string | null;
  position: number | null;
  promotionRecommendation: string;
  promotionReason: string;
  principalRemark: string | null;
}

@Injectable()
export class ResultPublicationService {
  constructor(
    private readonly tenantDb: TenantDbService,
    private readonly audit: AuditService,
    private readonly makerChecker: MakerCheckerService,
    private readonly cycles: ResultCycleService,
    private readonly artifacts: ResultArtifactService,
    private readonly signatures: SignatureService,
    private readonly delivery: DeliveryService,
  ) {}

  private get client(): Prisma.TransactionClient {
    return this.tenantDb.client;
  }
  private get prisma(): PrismaClient {
    return this.tenantDb.client as unknown as PrismaClient;
  }

  // ======================= publish =======================

  /** The maker submits a complete, moderated cycle for publish approval. */
  async requestPublish(tenantId: string, actor: ResultActor, cycleId: string) {
    const cycle = await this.cycles.loadCycle(tenantId, cycleId);
    this.cycles.assertAccess(actor, cycle);
    if (cycle.status !== 'moderation' && cycle.status !== 'entry_closed') {
      throw new BadRequestException(
        'Only a moderated (or entry-closed) cycle can be submitted for publish.',
      );
    }
    if (!cycle.gradingSystemId) {
      throw new BadRequestException(
        'Attach a grade scale (grading system) before publishing.',
      );
    }
    const validation = await this.cycles.validateCycle(
      tenantId,
      actor,
      cycleId,
    );
    if (!validation.complete) {
      throw new BadRequestException(
        `Cannot publish: ${validation.missing} result cell(s) are still missing. Mark absences explicitly.`,
      );
    }

    const approvalRequestId = await this.makerChecker.createApprovalRequest(
      this.prisma,
      RESULT_PUBLISH_OP,
      actor.userId,
      actor.clearanceLevel,
      { cycleId } as unknown as Prisma.InputJsonValue,
      tenantId,
    );
    const updated = await this.client.resultCycle.update({
      where: { id: cycleId },
      data: {
        status: 'pending_approval',
        approvalRequestId,
        updatedBy: actor.userId,
      },
    });
    await this.writeAudit(
      tenantId,
      actor.userId,
      'academics.results.request_publish',
      cycleId,
      `submitted result cycle ${cycle.name} for publish approval`,
      { approvalRequestId },
    );
    return {
      status: 'pending_approval' as const,
      approvalRequestId,
      cycle: updated,
    };
  }

  /** A second approver signs off; the immutable snapshot is published. */
  async approveAndPublish(
    tenantId: string,
    checker: ResultActor,
    cycleId: string,
    reason?: string,
  ) {
    const cycle = await this.cycles.loadCycle(tenantId, cycleId);
    this.cycles.assertAccess(checker, cycle);
    if (cycle.status !== 'pending_approval' || !cycle.approvalRequestId) {
      throw new BadRequestException(
        'This cycle is not awaiting publish approval.',
      );
    }
    const result = await this.makerChecker.approveRequest(
      this.prisma,
      cycle.approvalRequestId,
      checker.userId,
      checker.clearanceLevel,
      reason,
    );
    if (!result.approved) {
      throw new ForbiddenException(result.error ?? 'Approval failed');
    }

    const publication = await this.buildPublication(tenantId, checker, cycle, {
      version: 1,
      approvalRequestId: cycle.approvalRequestId,
    });

    await this.client.resultCycle.update({
      where: { id: cycleId },
      data: {
        status: 'published',
        publishedAt: new Date(),
        approvalRequestId: null,
        updatedBy: checker.userId,
      },
    });
    await this.writeAudit(
      tenantId,
      checker.userId,
      'academics.results.publish',
      cycleId,
      `published result cycle ${cycle.name} (v1, ${publication.studentCount} students)`,
      { publicationId: publication.id, checksum: publication.checksum },
    );
    return {
      status: 'published' as const,
      publicationId: publication.id,
      version: publication.version,
      checksum: publication.checksum,
      studentCount: publication.studentCount,
    };
  }

  // ======================= amendment =======================

  /** Raise a correction to an already-published result (maker-checker). */
  async requestAmendment(
    tenantId: string,
    actor: ResultActor,
    cycleId: string,
    dto: CreateAmendmentDto,
  ) {
    const cycle = await this.cycles.loadCycle(tenantId, cycleId);
    this.cycles.assertAccess(actor, cycle);
    if (cycle.status !== 'published') {
      throw new BadRequestException('Only a published cycle can be amended.');
    }
    const current = await this.currentPublication(tenantId, cycleId);
    if (!current)
      throw new BadRequestException('No current publication to amend.');

    // Validate every change targets a real component + an in-scope cell.
    const components = await this.client.resultComponent.findMany({
      where: { tenantId, cycleId },
      select: { id: true, key: true, maxScore: true },
    });
    const componentByKey = new Map(components.map((c) => [c.key, c]));
    for (const ch of dto.changes) {
      const comp = componentByKey.get(ch.componentKey);
      if (!comp) {
        throw new BadRequestException(
          `Unknown component "${ch.componentKey}" for this cycle.`,
        );
      }
      if (
        ch.score !== null &&
        ch.score !== undefined &&
        ch.score > Number(comp.maxScore)
      ) {
        throw new BadRequestException(
          `Corrected score ${ch.score} exceeds the max ${comp.maxScore} for ${ch.componentKey}.`,
        );
      }
    }

    const approvalRequestId = await this.makerChecker.createApprovalRequest(
      this.prisma,
      RESULT_AMEND_OP,
      actor.userId,
      actor.clearanceLevel,
      {
        cycleId,
        publicationId: current.id,
      } as unknown as Prisma.InputJsonValue,
      tenantId,
    );
    const amendment = await this.client.resultAmendment.create({
      data: {
        tenantId,
        cycleId,
        publicationId: current.id,
        status: 'pending_approval',
        reason: dto.reason.trim(),
        changes: dto.changes as unknown as Prisma.InputJsonValue,
        approvalRequestId,
        requestedBy: actor.userId,
      },
    });
    await this.writeAudit(
      tenantId,
      actor.userId,
      'academics.results.request_amend',
      amendment.id,
      `requested amendment to ${cycle.name}: ${dto.reason}`,
      { approvalRequestId, changes: dto.changes.length },
    );
    return { status: 'pending_approval' as const, amendmentId: amendment.id };
  }

  /** A second approver signs off; entries are corrected and a new version published. */
  async approveAmendment(
    tenantId: string,
    checker: ResultActor,
    amendmentId: string,
    reason?: string,
  ) {
    const amendment = await this.client.resultAmendment.findFirst({
      where: { id: amendmentId, tenantId },
    });
    if (!amendment) throw new NotFoundException('Amendment not found');
    if (
      amendment.status !== 'pending_approval' ||
      !amendment.approvalRequestId
    ) {
      throw new BadRequestException('This amendment is not awaiting approval.');
    }
    const cycle = await this.cycles.loadCycle(tenantId, amendment.cycleId);
    this.cycles.assertAccess(checker, cycle);

    const result = await this.makerChecker.approveRequest(
      this.prisma,
      amendment.approvalRequestId,
      checker.userId,
      checker.clearanceLevel,
      reason,
    );
    if (!result.approved) {
      throw new ForbiddenException(result.error ?? 'Approval failed');
    }

    // Apply the corrections to the underlying entries so the recomputed snapshot
    // is consistent with the working data.
    const components = await this.client.resultComponent.findMany({
      where: { tenantId, cycleId: cycle.id },
      select: { id: true, key: true, maxScore: true },
    });
    const componentByKey = new Map(components.map((c) => [c.key, c]));
    const changes =
      amendment.changes as unknown as CreateAmendmentDto['changes'];
    for (const ch of changes) {
      const comp = componentByKey.get(ch.componentKey);
      if (!comp) continue;
      const isExempt = ch.isExempt ?? false;
      const isAbsent = !isExempt && (ch.isAbsent ?? false);
      const score =
        isAbsent || isExempt || ch.score === null || ch.score === undefined
          ? null
          : new Prisma.Decimal(ch.score);
      await this.client.resultEntry.upsert({
        where: {
          cycleId_studentId_subjectOfferingId_componentId: {
            cycleId: cycle.id,
            studentId: ch.studentId,
            subjectOfferingId: ch.subjectOfferingId,
            componentId: comp.id,
          },
        },
        create: {
          tenantId,
          cycleId: cycle.id,
          componentId: comp.id,
          studentId: ch.studentId,
          subjectOfferingId: ch.subjectOfferingId,
          score,
          isAbsent,
          isExempt,
          enteredBy: checker.userId,
        },
        update: { score, isAbsent, isExempt, enteredBy: checker.userId },
      });
    }

    const prior = await this.currentPublication(tenantId, cycle.id);
    const nextVersion = (prior?.version ?? 0) + 1;
    const publication = await this.buildPublication(tenantId, checker, cycle, {
      version: nextVersion,
      approvalRequestId: amendment.approvalRequestId,
      amendmentReason: amendment.reason,
    });

    if (prior) {
      await this.client.resultPublication.update({
        where: { id: prior.id },
        data: {
          status: 'superseded',
          supersededById: publication.id,
          supersededAt: new Date(),
        },
      });
    }
    await this.client.resultAmendment.update({
      where: { id: amendmentId },
      data: {
        status: 'applied',
        approvedBy: checker.userId,
        appliedAt: new Date(),
        resultingPublicationId: publication.id,
      },
    });
    await this.writeAudit(
      tenantId,
      checker.userId,
      'academics.results.amend',
      amendment.id,
      `applied amendment to ${cycle.name} → v${nextVersion}`,
      {
        publicationId: publication.id,
        supersededId: prior?.id,
        checksum: publication.checksum,
      },
    );
    return {
      status: 'applied' as const,
      publicationId: publication.id,
      version: nextVersion,
      supersededId: prior?.id ?? null,
    };
  }

  // ======================= reads =======================

  async listAmendments(tenantId: string, actor: ResultActor, cycleId: string) {
    const cycle = await this.cycles.loadCycle(tenantId, cycleId);
    this.cycles.assertAccess(actor, cycle);
    return this.client.resultAmendment.findMany({
      where: { tenantId, cycleId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        reason: true,
        changes: true,
        requestedBy: true,
        approvedBy: true,
        appliedAt: true,
        resultingPublicationId: true,
        createdAt: true,
      },
    });
  }

  async listPublications(
    tenantId: string,
    actor: ResultActor,
    cycleId: string,
  ) {
    const cycle = await this.cycles.loadCycle(tenantId, cycleId);
    this.cycles.assertAccess(actor, cycle);
    return this.client.resultPublication.findMany({
      where: { tenantId, cycleId },
      orderBy: { version: 'desc' },
      select: {
        id: true,
        version: true,
        status: true,
        checksum: true,
        amendmentReason: true,
        broadsheetDocumentId: true,
        publishedAt: true,
        publishedBy: true,
      },
    });
  }

  /**
   * A publication + its per-student results. Each student is annotated with
   * `visibleToGuardian` — false when an active FinancialHold gates their result
   * (an audited decision, never a silent blank).
   */
  async getPublication(
    tenantId: string,
    actor: ResultActor,
    publicationId: string,
  ) {
    const publication = await this.client.resultPublication.findFirst({
      where: { id: publicationId, tenantId },
    });
    if (!publication) throw new NotFoundException('Publication not found');
    const cycle = await this.cycles.loadCycle(tenantId, publication.cycleId);
    this.cycles.assertAccess(actor, cycle);

    const results = await this.client.publishedStudentResult.findMany({
      where: { tenantId, publicationId },
      orderBy: [{ sectionLabel: 'asc' }, { studentName: 'asc' }],
    });
    const studentIds = results.map((r) => r.studentId);
    const holds = studentIds.length
      ? await this.client.financialHold.findMany({
          where: { tenantId, studentId: { in: studentIds }, status: 'active' },
          select: { studentId: true },
        })
      : [];
    const held = new Set(holds.map((h) => h.studentId));

    return {
      publication: {
        id: publication.id,
        version: publication.version,
        status: publication.status,
        checksum: publication.checksum,
        amendmentReason: publication.amendmentReason,
        broadsheetDocumentId: publication.broadsheetDocumentId,
        publishedAt: publication.publishedAt,
      },
      students: results.map((r) => ({
        id: r.id,
        studentId: r.studentId,
        studentNumber: r.studentNumber,
        studentName: r.studentName,
        sectionLabel: r.sectionLabel,
        subjects: r.subjects,
        average: r.average === null ? null : Number(r.average),
        overallGrade: r.overallGrade,
        position: r.position,
        promotionRecommendation: r.promotionRecommendation,
        promotionReason: r.promotionReason,
        reportCardDocumentId: r.reportCardDocumentId,
        checksum: r.checksum,
        visibleToGuardian: !held.has(r.studentId),
      })),
    };
  }

  // ======================= build (shared) =======================

  private async buildPublication(
    tenantId: string,
    actor: ResultActor,
    cycle: {
      id: string;
      name: string;
      academicYearId: string;
      termId: string | null;
      gradingSystemId: string | null;
      subjectRemarkRuleSetId: string | null;
      principalRemarkRuleSetId: string | null;
      promotionPolicy: Prisma.JsonValue;
      rankingEnabled: boolean;
    },
    opts: {
      version: number;
      approvalRequestId?: string;
      amendmentReason?: string;
    },
  ) {
    const [
      componentsRaw,
      scope,
      gradingSystem,
      subjectRules,
      principalRules,
      meta,
    ] = await Promise.all([
      this.client.resultComponent.findMany({
        where: { tenantId, cycleId: cycle.id },
        orderBy: { order: 'asc' },
      }),
      this.cycles.resolveScope(tenantId, cycle),
      cycle.gradingSystemId
        ? this.client.gradingSystem.findFirst({
            where: { id: cycle.gradingSystemId, tenantId },
            select: { id: true, name: true, gradeScale: true },
          })
        : Promise.resolve(null),
      this.loadRules(tenantId, cycle.subjectRemarkRuleSetId),
      this.loadRules(tenantId, cycle.principalRemarkRuleSetId),
      this.loadMeta(tenantId, cycle.academicYearId, cycle.termId),
    ]);

    const components: ComponentLite[] = componentsRaw.map((c) => ({
      id: c.id,
      key: c.key,
      label: c.label,
      maxScore: Number(c.maxScore),
    }));
    const scale = (gradingSystem?.gradeScale ??
      null) as unknown as GradeScale | null;
    const policy = (cycle.promotionPolicy ??
      null) as unknown as PromotionPolicy | null;

    // (student, offering, component) → entry
    const entries = await this.client.resultEntry.findMany({
      where: { tenantId, cycleId: cycle.id },
      select: {
        studentId: true,
        subjectOfferingId: true,
        componentId: true,
        score: true,
        isAbsent: true,
        isExempt: true,
      },
    });
    const entryByCell = new Map<string, EntryLite>();
    for (const e of entries) {
      entryByCell.set(
        `${e.studentId}::${e.subjectOfferingId}::${e.componentId}`,
        {
          score: e.score === null ? null : Number(e.score),
          isAbsent: e.isAbsent,
          isExempt: e.isExempt,
        },
      );
    }

    // Profiles (for notification) for the published students.
    const allStudentIds = [
      ...new Set(
        [...scope.studentsBySectionId.values()].flatMap((ss) =>
          ss.map((s) => s.id),
        ),
      ),
    ];
    const profiles = allStudentIds.length
      ? await this.client.student.findMany({
          where: { id: { in: allStudentIds }, tenantId },
          select: { id: true, userTenantId: true, personId: true },
        })
      : [];
    const profileByStudent = new Map(profiles.map((p) => [p.id, p]));

    // Compute per-student snapshots (sorted by section then studentId → stable).
    const students: SnapshotStudent[] = [];
    const sectionOf = new Map<string, string>(); // studentId → sectionLabel
    for (const section of scope.sections) {
      const roster = (scope.studentsBySectionId.get(section.id) ?? [])
        .slice()
        .sort((a, b) => a.id.localeCompare(b.id));
      const offerings = (scope.offeringsBySectionId.get(section.id) ?? [])
        .slice()
        .sort(
          (a, b) =>
            a.subjectLabel.localeCompare(b.subjectLabel) ||
            a.id.localeCompare(b.id),
        );
      for (const student of roster) {
        const subjects: SnapshotSubject[] = offerings.map((offering) => {
          const cellEntries = new Map<string, EntryLite>();
          for (const c of components) {
            const e = entryByCell.get(`${student.id}::${offering.id}::${c.id}`);
            if (e) cellEntries.set(c.id, e);
          }
          const comp = computeSubjectResult(components, cellEntries);
          const grade = resolveGrade(scale, comp.percentage);
          return {
            subjectOfferingId: offering.id,
            subjectLabel: offering.subjectLabel,
            components: comp.components,
            total: comp.total,
            maxTotal: comp.maxTotal,
            percentage: comp.percentage,
            letterGrade: grade.grade,
            gradePoints: grade.points,
            remark: resolveRemark(subjectRules, comp.percentage),
          };
        });
        const overall = computeOverall(subjects);
        const overallGrade = resolveGrade(scale, overall.average);
        const promotion = recommendPromotion(
          policy,
          subjects.map((s) => ({
            subjectOfferingId: s.subjectOfferingId,
            subjectLabel: s.subjectLabel,
            percentage: s.percentage,
            isAbsent:
              s.percentage === null && !s.components.every((c) => c.isExempt),
            isExempt:
              s.components.length > 0 && s.components.every((c) => c.isExempt),
          })),
        );
        students.push({
          studentId: student.id,
          studentNumber: student.studentNumber,
          studentName: student.name,
          classSectionId: section.id,
          sectionLabel: section.displayLabel,
          subjects,
          overallTotal: overall.overallTotal,
          overallMax: overall.overallMax,
          average: overall.average,
          overallGrade: overallGrade.grade,
          position: null,
          promotionRecommendation: promotion.recommendation,
          promotionReason: promotion.reason,
          principalRemark: resolveRemark(principalRules, overall.average),
        });
        sectionOf.set(student.id, section.displayLabel);
      }
    }

    // Ranking (policy, default off): position within each section by average desc.
    if (cycle.rankingEnabled) {
      const bySection = new Map<string, SnapshotStudent[]>();
      for (const s of students) {
        const key = s.classSectionId ?? '';
        (bySection.get(key) ?? bySection.set(key, []).get(key)!).push(s);
      }
      for (const group of bySection.values()) {
        group
          .filter((s) => s.average !== null)
          .sort((a, b) => (b.average ?? 0) - (a.average ?? 0))
          .forEach((s, i) => (s.position = i + 1));
      }
    }

    const snapshot = {
      cycle: {
        id: cycle.id,
        name: cycle.name,
        academicYearId: cycle.academicYearId,
        academicYearName: meta.academicYearName,
        termId: cycle.termId,
        termName: meta.termName,
        rankingEnabled: cycle.rankingEnabled,
      },
      gradingSystem: gradingSystem
        ? { id: gradingSystem.id, name: gradingSystem.name, scale }
        : null,
      components: componentsRaw.map((c) => ({
        key: c.key,
        label: c.label,
        maxScore: Number(c.maxScore),
        weight: c.weight === null ? null : Number(c.weight),
        order: c.order,
        isExam: c.isExam,
      })),
      subjectRemarkRuleSet: subjectRules,
      principalRemarkRuleSet: principalRules,
      promotionPolicy: policy,
      students,
    };
    const checksum = checksumOf(snapshot);

    const publication = await this.client.resultPublication.create({
      data: {
        tenantId,
        cycleId: cycle.id,
        version: opts.version,
        status: 'published',
        snapshot: snapshot as unknown as Prisma.InputJsonValue,
        checksum,
        approvalRequestId: opts.approvalRequestId ?? null,
        amendmentReason: opts.amendmentReason ?? null,
        publishedBy: actor.userId,
      },
    });

    // Per-student rows + report-card artifacts.
    const artMeta = {
      schoolName: meta.schoolName,
      cycleName: cycle.name,
      academicYearName: meta.academicYearName,
      termName: meta.termName,
      version: opts.version,
      publishedAt: publication.publishedAt.toISOString().slice(0, 10),
    };
    for (const s of students) {
      const perStudentChecksum = checksumOf(s);
      const artStudent = this.toArtifactStudent(s);
      const card = await this.artifacts.storeReportCard(
        tenantId,
        actor.userId,
        publication.id,
        artMeta,
        artStudent,
      );
      await this.client.publishedStudentResult.create({
        data: {
          tenantId,
          publicationId: publication.id,
          cycleId: cycle.id,
          studentId: s.studentId,
          studentNumber: s.studentNumber,
          studentName: s.studentName,
          classSectionId: s.classSectionId,
          sectionLabel: s.sectionLabel,
          subjects: s.subjects as unknown as Prisma.InputJsonValue,
          overallTotal:
            s.overallTotal === null ? null : new Prisma.Decimal(s.overallTotal),
          overallMax:
            s.overallMax === null ? null : new Prisma.Decimal(s.overallMax),
          average: s.average === null ? null : new Prisma.Decimal(s.average),
          overallGrade: s.overallGrade,
          position: s.position,
          promotionRecommendation: s.promotionRecommendation,
          promotionReason: s.promotionReason,
          reportCardDocumentId: card.documentId,
          checksum: perStudentChecksum,
        },
      });
    }

    // One broadsheet per section (each its own DocumentArtifact).
    let firstBroadsheetId: string | null = null;
    for (const section of scope.sections) {
      const sectionStudents = students
        .filter((s) => s.classSectionId === section.id)
        .map((s) => this.toArtifactStudent(s));
      if (sectionStudents.length === 0) continue;
      const bs = await this.artifacts.storeBroadsheet(
        tenantId,
        actor.userId,
        publication.id,
        artMeta,
        section.displayLabel,
        sectionStudents,
      );
      firstBroadsheetId ??= bs.documentId;
    }
    if (scope.sections.length === 1 && firstBroadsheetId) {
      await this.client.resultPublication.update({
        where: { id: publication.id },
        data: { broadsheetDocumentId: firstBroadsheetId },
      });
    }

    // Best-effort signature (if a signing authority is configured).
    await this.applySignatureIfAvailable(
      tenantId,
      actor.userId,
      publication.id,
      checksum,
    );

    // Notify (F5) — best-effort in-app per student; never blocks publish.
    await this.notify(
      tenantId,
      actor.userId,
      cycle.name,
      students,
      profileByStudent,
    );

    return { ...publication, studentCount: students.length, checksum };
  }

  private toArtifactStudent(s: SnapshotStudent): ArtifactStudent {
    return {
      studentNumber: s.studentNumber,
      studentName: s.studentName,
      sectionLabel: s.sectionLabel,
      subjects: s.subjects.map((sub) => ({
        subjectLabel: sub.subjectLabel,
        components: sub.components,
        total: sub.total,
        maxTotal: sub.maxTotal,
        percentage: sub.percentage,
        letterGrade: sub.letterGrade,
        remark: sub.remark,
      })),
      average: s.average,
      overallGrade: s.overallGrade,
      position: s.position,
      promotionRecommendation: s.promotionRecommendation,
      promotionReason: s.promotionReason,
      principalRemark: s.principalRemark,
    };
  }

  private async applySignatureIfAvailable(
    tenantId: string,
    actorId: string,
    publicationId: string,
    checksum: string,
  ) {
    const now = new Date();
    const authority = await this.client.signingAuthority.findFirst({
      where: {
        tenantId,
        status: 'active',
        validFrom: { lte: now },
        OR: [{ validTo: null }, { validTo: { gte: now } }],
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (!authority) return;
    try {
      await this.signatures.applySignature(tenantId, actorId, {
        signingAuthorityId: authority.id,
        artifactType: 'ResultPublication',
        artifactId: publicationId,
        artifactChecksum: checksum,
        reason: 'Result publication',
      });
    } catch {
      // A signature is best-effort here; publication is not blocked by it.
    }
  }

  private async notify(
    tenantId: string,
    actorId: string,
    cycleName: string,
    students: SnapshotStudent[],
    profileByStudent: Map<
      string,
      { userTenantId: string; personId: string | null }
    >,
  ) {
    for (const s of students) {
      const profile = profileByStudent.get(s.studentId);
      if (!profile) continue;
      try {
        await this.delivery.send({
          tenantId,
          channel: 'in_app',
          category: 'transactional',
          profileId: profile.userTenantId,
          personId: profile.personId ?? undefined,
          subject: 'Your results are ready',
          body: `Results for "${cycleName}" have been published.`,
          dedupeKey: `result-published:${s.studentId}:${cycleName}`,
          actorId,
          metadata: { kind: 'result_published' },
        });
      } catch {
        // Delivery failures are ledgered by F5; they never block publication.
      }
    }
  }

  private async loadRules(
    tenantId: string,
    ruleSetId: string | null,
  ): Promise<RemarkRuleLite[] | null> {
    if (!ruleSetId) return null;
    const rules = await this.client.remarkRule.findMany({
      where: { tenantId, ruleSetId },
      orderBy: { order: 'asc' },
      select: { minPercentage: true, maxPercentage: true, comment: true },
    });
    return rules.map((r) => ({
      minPercentage: Number(r.minPercentage),
      maxPercentage: Number(r.maxPercentage),
      comment: r.comment,
    }));
  }

  private async loadMeta(
    tenantId: string,
    academicYearId: string,
    termId: string | null,
  ) {
    const [year, term, tenant] = await Promise.all([
      this.client.academicYear.findFirst({
        where: { id: academicYearId, tenantId },
        select: { name: true },
      }),
      termId
        ? this.client.term.findFirst({
            where: { id: termId, tenantId },
            select: { name: true },
          })
        : Promise.resolve(null),
      this.client.tenant.findFirst({
        where: { id: tenantId },
        select: { name: true },
      }),
    ]);
    return {
      academicYearName: year?.name ?? 'Academic year',
      termName: term?.name ?? null,
      schoolName: tenant?.name ?? 'School',
    };
  }

  private async currentPublication(tenantId: string, cycleId: string) {
    return this.client.resultPublication.findFirst({
      where: { tenantId, cycleId, status: 'published' },
      orderBy: { version: 'desc' },
      select: { id: true, version: true },
    });
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
      resource: 'result_publication',
      resourceId,
      actorId,
      description,
      metadata,
    });
  }
}
