/**
 * WB4 · ResultCycleService — configure a cycle and drive its lifecycle up to the
 * publish gate (ADR-04):
 *
 *   Configure (components · sections · grade scale · remark sets · promotion
 *   policy) → Open entry → (Validate/completeness) → Close entry → Moderate
 *
 * Publish + amend live in ResultPublicationService (maker-checker). Every read is
 * campus-scoped via the WB1-6 AccessScopeService; writes run on the request's
 * tenant-scoped client (RLS, no privileged client).
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
import {
  AccessScopeService,
  type ScopeDescriptor,
} from '../../auth/services/access-scope.service';
import type { ResultActor } from './results.types';
import type {
  ConfigureComponentsDto,
  CreateRemarkRuleSetDto,
  CreateResultCycleDto,
  SetCycleSectionsDto,
  UpdateResultCycleDto,
} from '../dto';

/** A section in a cycle's scope, with its offerings + enrolled students. */
export interface CycleScope {
  sections: { id: string; displayLabel: string; campusId: string }[];
  offeringsBySectionId: Map<
    string,
    { id: string; subjectLabel: string; isElective: boolean }[]
  >;
  studentsBySectionId: Map<
    string,
    { id: string; studentNumber: string; name: string }[]
  >;
}

@Injectable()
export class ResultCycleService {
  constructor(
    private readonly tenantDb: TenantDbService,
    private readonly audit: AuditService,
    private readonly accessScope: AccessScopeService,
  ) {}

  private get client(): Prisma.TransactionClient {
    return this.tenantDb.client;
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
      resource: 'result_cycle',
      resourceId,
      actorId,
      description,
      metadata,
    });
  }

  // ======================= create / read =======================

  async createCycle(
    tenantId: string,
    actor: ResultActor,
    dto: CreateResultCycleDto,
  ) {
    if (dto.campusId) {
      await this.assertCampus(tenantId, dto.campusId);
      this.accessScope.assertWithinScope(actor.grantScope, {
        campusId: dto.campusId,
      });
    }
    await this.assertAcademicYear(tenantId, dto.academicYearId);
    if (dto.termId) await this.assertTerm(tenantId, dto.termId);
    if (dto.yearLevelId) await this.assertYearLevel(tenantId, dto.yearLevelId);

    const cycle = await this.client.resultCycle.create({
      data: {
        tenantId,
        campusId: dto.campusId ?? null,
        name: dto.name.trim(),
        academicYearId: dto.academicYearId,
        termId: dto.termId ?? null,
        yearLevelId: dto.yearLevelId ?? null,
        status: 'draft',
        createdBy: actor.userId,
      },
    });
    await this.writeAudit(
      tenantId,
      actor.userId,
      'academics.results.cycle.create',
      cycle.id,
      `created result cycle ${cycle.name}`,
    );
    return cycle;
  }

  async listCycles(tenantId: string, actor: ResultActor) {
    const campusId = this.scopedCampusId(actor.grantScope);
    return this.client.resultCycle.findMany({
      where: { tenantId, ...(campusId ? { campusId } : {}) },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getCycle(tenantId: string, actor: ResultActor, cycleId: string) {
    const cycle = await this.loadCycle(tenantId, cycleId);
    this.assertCycleScope(actor, cycle);
    const [components, sections] = await Promise.all([
      this.client.resultComponent.findMany({
        where: { tenantId, cycleId },
        orderBy: { order: 'asc' },
      }),
      this.client.resultCycleSection.findMany({
        where: { tenantId, cycleId },
      }),
    ]);
    const sectionIds = sections.map((s) => s.classSectionId);
    const sectionLabels = sectionIds.length
      ? await this.client.classSection.findMany({
          where: { id: { in: sectionIds }, tenantId },
          select: { id: true, displayLabel: true },
        })
      : [];
    const labelOf = new Map(sectionLabels.map((s) => [s.id, s.displayLabel]));
    return {
      cycle,
      components,
      sections: sections.map((s) => ({
        id: s.id,
        classSectionId: s.classSectionId,
        displayLabel: labelOf.get(s.classSectionId) ?? null,
      })),
    };
  }

  // ======================= configuration =======================

  async updateCycle(
    tenantId: string,
    actor: ResultActor,
    cycleId: string,
    dto: UpdateResultCycleDto,
  ) {
    const cycle = await this.loadCycle(tenantId, cycleId);
    this.assertCycleScope(actor, cycle);
    if (
      cycle.status === 'published' ||
      cycle.status === 'archived' ||
      cycle.status === 'pending_approval'
    ) {
      // Frozen once submitted for approval so the checker approves exactly the
      // configuration they reviewed (no maker-checker TOCTOU); cancel or let the
      // approval lapse to reconfigure.
      throw new BadRequestException(
        `A cycle that is ${cycle.status.replace(/_/g, ' ')} can no longer be reconfigured.`,
      );
    }
    if (dto.gradingSystemId) {
      await this.assertGradingSystem(tenantId, dto.gradingSystemId);
    }
    if (dto.subjectRemarkRuleSetId) {
      await this.assertRuleSet(tenantId, dto.subjectRemarkRuleSetId, 'subject');
    }
    if (dto.principalRemarkRuleSetId) {
      await this.assertRuleSet(
        tenantId,
        dto.principalRemarkRuleSetId,
        'principal',
      );
    }
    const updated = await this.client.resultCycle.update({
      where: { id: cycleId },
      data: {
        name: dto.name?.trim() ?? undefined,
        gradingSystemId: dto.gradingSystemId ?? undefined,
        subjectRemarkRuleSetId: dto.subjectRemarkRuleSetId ?? undefined,
        principalRemarkRuleSetId: dto.principalRemarkRuleSetId ?? undefined,
        rankingEnabled: dto.rankingEnabled ?? undefined,
        promotionPolicy:
          dto.promotionPolicy === undefined
            ? undefined
            : (dto.promotionPolicy as unknown as Prisma.InputJsonValue),
        updatedBy: actor.userId,
      },
    });
    await this.writeAudit(
      tenantId,
      actor.userId,
      'academics.results.cycle.update',
      cycleId,
      `updated result cycle ${cycle.name}`,
    );
    return updated;
  }

  async configureComponents(
    tenantId: string,
    actor: ResultActor,
    cycleId: string,
    dto: ConfigureComponentsDto,
  ) {
    const cycle = await this.loadCycle(tenantId, cycleId);
    this.assertCycleScope(actor, cycle);
    this.assertConfigurable(cycle.status);
    if (dto.components.length === 0) {
      throw new BadRequestException('A cycle needs at least one component.');
    }
    const keys = dto.components.map((c) => c.key.trim());
    if (new Set(keys).size !== keys.length) {
      throw new BadRequestException('Component keys must be unique.');
    }

    // Replace the component set wholesale (only allowed pre-entry, so no entries
    // are orphaned).
    await this.client.resultComponent.deleteMany({
      where: { tenantId, cycleId },
    });
    await this.client.resultComponent.createMany({
      data: dto.components.map((c, i) => ({
        tenantId,
        cycleId,
        key: c.key.trim(),
        label: c.label.trim(),
        maxScore: new Prisma.Decimal(c.maxScore),
        weight: c.weight === undefined ? null : new Prisma.Decimal(c.weight),
        order: c.order ?? i,
        isExam: c.isExam ?? false,
      })),
    });
    await this.writeAudit(
      tenantId,
      actor.userId,
      'academics.results.cycle.components',
      cycleId,
      `configured ${dto.components.length} components on ${cycle.name}`,
    );
    return this.client.resultComponent.findMany({
      where: { tenantId, cycleId },
      orderBy: { order: 'asc' },
    });
  }

  async setSections(
    tenantId: string,
    actor: ResultActor,
    cycleId: string,
    dto: SetCycleSectionsDto,
  ) {
    const cycle = await this.loadCycle(tenantId, cycleId);
    this.assertCycleScope(actor, cycle);
    this.assertConfigurable(cycle.status);

    const ids = [...new Set(dto.classSectionIds)];
    const sections = ids.length
      ? await this.client.classSection.findMany({
          where: { id: { in: ids }, tenantId },
          select: { id: true, campusId: true },
        })
      : [];
    if (sections.length !== ids.length) {
      throw new BadRequestException(
        'One or more class sections were not found for this tenant.',
      );
    }
    // A campus-scoped cycle can only include its own campus's sections.
    for (const s of sections) {
      this.accessScope.assertWithinScope(actor.grantScope, {
        campusId: s.campusId,
      });
      if (cycle.campusId && s.campusId !== cycle.campusId) {
        throw new BadRequestException(
          'A section belongs to a different campus than this cycle.',
        );
      }
    }

    await this.client.resultCycleSection.deleteMany({
      where: { tenantId, cycleId },
    });
    if (ids.length) {
      await this.client.resultCycleSection.createMany({
        data: ids.map((classSectionId) => ({
          tenantId,
          cycleId,
          classSectionId,
        })),
      });
    }
    await this.writeAudit(
      tenantId,
      actor.userId,
      'academics.results.cycle.sections',
      cycleId,
      `set ${ids.length} sections on ${cycle.name}`,
    );
    return { count: ids.length };
  }

  // ======================= lifecycle transitions =======================

  async openEntry(tenantId: string, actor: ResultActor, cycleId: string) {
    const cycle = await this.loadCycle(tenantId, cycleId);
    this.assertCycleScope(actor, cycle);
    if (cycle.status !== 'draft' && cycle.status !== 'entry_closed') {
      throw new BadRequestException(
        'Entry can only be opened from a draft or entry-closed cycle.',
      );
    }
    const [componentCount, sectionCount] = await Promise.all([
      this.client.resultComponent.count({ where: { tenantId, cycleId } }),
      this.client.resultCycleSection.count({ where: { tenantId, cycleId } }),
    ]);
    if (componentCount === 0) {
      throw new BadRequestException(
        'Configure components before opening entry.',
      );
    }
    if (sectionCount === 0) {
      throw new BadRequestException('Add class sections before opening entry.');
    }
    return this.transition(
      tenantId,
      actor,
      cycle.id,
      cycle.name,
      'entry_open',
      {
        entryOpenedAt: new Date(),
      },
    );
  }

  async closeEntry(tenantId: string, actor: ResultActor, cycleId: string) {
    const cycle = await this.loadCycle(tenantId, cycleId);
    this.assertCycleScope(actor, cycle);
    if (cycle.status !== 'entry_open') {
      throw new BadRequestException(
        'Only an open cycle can be closed for entry.',
      );
    }
    return this.transition(
      tenantId,
      actor,
      cycle.id,
      cycle.name,
      'entry_closed',
      {
        entryClosedAt: new Date(),
      },
    );
  }

  async moveToModeration(
    tenantId: string,
    actor: ResultActor,
    cycleId: string,
  ) {
    const cycle = await this.loadCycle(tenantId, cycleId);
    this.assertCycleScope(actor, cycle);
    if (cycle.status !== 'entry_closed') {
      throw new BadRequestException(
        'Only an entry-closed cycle can move to moderation.',
      );
    }
    return this.transition(tenantId, actor, cycle.id, cycle.name, 'moderation');
  }

  async cancelCycle(
    tenantId: string,
    actor: ResultActor,
    cycleId: string,
    reason?: string,
  ) {
    const cycle = await this.loadCycle(tenantId, cycleId);
    this.assertCycleScope(actor, cycle);
    if (cycle.status === 'published' || cycle.status === 'archived') {
      throw new BadRequestException(
        'A published or archived cycle cannot be cancelled.',
      );
    }
    return this.transition(
      tenantId,
      actor,
      cycle.id,
      cycle.name,
      'cancelled',
      {},
      reason,
    );
  }

  private async transition(
    tenantId: string,
    actor: ResultActor,
    cycleId: string,
    name: string,
    status: string,
    extra: Prisma.ResultCycleUpdateInput = {},
    reason?: string,
  ) {
    const updated = await this.client.resultCycle.update({
      where: { id: cycleId },
      data: { status, updatedBy: actor.userId, ...extra },
    });
    await this.writeAudit(
      tenantId,
      actor.userId,
      `academics.results.cycle.${status}`,
      cycleId,
      `moved result cycle ${name} → ${status}`,
      reason ? { reason } : undefined,
    );
    return updated;
  }

  // ======================= validation / completeness =======================

  /**
   * A completeness + validation report over the cycle's expected (student ·
   * offering) pairs: how many components are entered, missing, absent, exempt.
   * The publish gate refuses a cycle with missing entries; an absent learner is
   * flagged (not zeroed).
   */
  async validateCycle(tenantId: string, actor: ResultActor, cycleId: string) {
    const cycle = await this.loadCycle(tenantId, cycleId);
    this.assertCycleScope(actor, cycle);
    const [components, scope] = await Promise.all([
      this.client.resultComponent.findMany({ where: { tenantId, cycleId } }),
      this.resolveScope(tenantId, cycle),
    ]);
    const entries = await this.client.resultEntry.findMany({
      where: { tenantId, cycleId },
      select: {
        studentId: true,
        subjectOfferingId: true,
        componentId: true,
        score: true,
        isAbsent: true,
        isExempt: true,
      },
    });
    const entryKey = (s: string, o: string, c: string) => `${s}::${o}::${c}`;
    const byKey = new Map(
      entries.map((e) => [
        entryKey(e.studentId, e.subjectOfferingId, e.componentId),
        e,
      ]),
    );

    let expectedCells = 0;
    let entered = 0;
    let missing = 0;
    let absent = 0;
    let exempt = 0;
    const missingSamples: {
      studentId: string;
      subjectOfferingId: string;
      componentKey: string;
    }[] = [];

    for (const [sectionId, students] of scope.studentsBySectionId) {
      const offerings = scope.offeringsBySectionId.get(sectionId) ?? [];
      for (const student of students) {
        for (const offering of offerings) {
          for (const component of components) {
            expectedCells += 1;
            const e = byKey.get(
              entryKey(student.id, offering.id, component.id),
            );
            if (!e) {
              missing += 1;
              if (missingSamples.length < 25) {
                missingSamples.push({
                  studentId: student.id,
                  subjectOfferingId: offering.id,
                  componentKey: component.key,
                });
              }
            } else if (e.isExempt) {
              exempt += 1;
            } else if (e.isAbsent) {
              absent += 1;
            } else if (e.score !== null) {
              entered += 1;
            } else {
              missing += 1;
            }
          }
        }
      }
    }

    return {
      cycleId,
      status: cycle.status,
      studentCount: [...scope.studentsBySectionId.values()].reduce(
        (n, s) => n + s.length,
        0,
      ),
      componentCount: components.length,
      expectedCells,
      entered,
      missing,
      absent,
      exempt,
      complete: missing === 0 && expectedCells > 0,
      missingSamples,
    };
  }

  // ======================= remark rule sets =======================

  async createRemarkRuleSet(
    tenantId: string,
    actor: ResultActor,
    dto: CreateRemarkRuleSetDto,
  ) {
    for (const r of dto.rules) {
      if (r.minPercentage > r.maxPercentage) {
        throw new BadRequestException(
          'A remark band min cannot exceed its max.',
        );
      }
    }
    const set = await this.client.remarkRuleSet.create({
      data: {
        tenantId,
        name: dto.name.trim(),
        kind: dto.kind,
        createdBy: actor.userId,
        rules: {
          create: dto.rules.map((r, i) => ({
            tenantId,
            minPercentage: new Prisma.Decimal(r.minPercentage),
            maxPercentage: new Prisma.Decimal(r.maxPercentage),
            comment: r.comment.trim(),
            order: r.order ?? i,
          })),
        },
      },
      include: { rules: { orderBy: { order: 'asc' } } },
    });
    await this.writeAudit(
      tenantId,
      actor.userId,
      'academics.results.remark_set.create',
      set.id,
      `created ${dto.kind} remark rule set ${set.name}`,
    );
    return set;
  }

  async listRemarkRuleSets(tenantId: string) {
    return this.client.remarkRuleSet.findMany({
      where: { tenantId },
      include: { rules: { orderBy: { order: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ======================= scope resolution (shared) =======================

  /**
   * The cycle's expected roster: for each included section, its active students
   * and its subject offerings (K-12 class model — every student in the section
   * takes the section's offerings). Used by validation, the entry grid, and
   * publish so all three agree on what "complete" means.
   */
  async resolveScope(
    tenantId: string,
    cycle: { id: string; academicYearId: string; termId: string | null },
  ): Promise<CycleScope> {
    const cycleSections = await this.client.resultCycleSection.findMany({
      where: { tenantId, cycleId: cycle.id },
      select: { classSectionId: true },
    });
    const sectionIds = cycleSections.map((s) => s.classSectionId);
    if (sectionIds.length === 0) {
      return {
        sections: [],
        offeringsBySectionId: new Map(),
        studentsBySectionId: new Map(),
      };
    }

    const [sections, offerings, enrollments] = await Promise.all([
      this.client.classSection.findMany({
        where: { id: { in: sectionIds }, tenantId },
        select: { id: true, displayLabel: true, campusId: true },
      }),
      this.client.subjectOffering.findMany({
        where: {
          tenantId,
          classSectionId: { in: sectionIds },
          academicYearId: cycle.academicYearId,
          status: 'active',
          // year-long cycle (no term) includes all offerings; a termed cycle
          // includes that term's offerings and year-long (termId null) ones.
          ...(cycle.termId
            ? { OR: [{ termId: cycle.termId }, { termId: null }] }
            : {}),
        },
        select: {
          id: true,
          classSectionId: true,
          subjectLabel: true,
          isElective: true,
        },
      }),
      this.client.sectionEnrollment.findMany({
        where: {
          tenantId,
          classSectionId: { in: sectionIds },
          academicYearId: cycle.academicYearId,
          status: 'active',
        },
        select: { studentId: true, classSectionId: true },
      }),
    ]);

    const studentIds = [...new Set(enrollments.map((e) => e.studentId))];
    const students = studentIds.length
      ? await this.client.student.findMany({
          where: { id: { in: studentIds }, tenantId },
          select: {
            id: true,
            studentNumber: true,
            userTenant: {
              select: {
                user: { select: { firstName: true, lastName: true } },
              },
            },
          },
        })
      : [];
    const studentById = new Map(
      students.map((s) => [
        s.id,
        {
          id: s.id,
          studentNumber: s.studentNumber,
          name:
            `${s.userTenant?.user?.firstName ?? ''} ${s.userTenant?.user?.lastName ?? ''}`.trim() ||
            s.studentNumber,
        },
      ]),
    );

    const offeringsBySectionId = new Map<
      string,
      { id: string; subjectLabel: string; isElective: boolean }[]
    >();
    for (const o of offerings) {
      const list = offeringsBySectionId.get(o.classSectionId) ?? [];
      list.push({
        id: o.id,
        subjectLabel: o.subjectLabel,
        isElective: o.isElective,
      });
      offeringsBySectionId.set(o.classSectionId, list);
    }

    const studentsBySectionId = new Map<
      string,
      { id: string; studentNumber: string; name: string }[]
    >();
    for (const e of enrollments) {
      const student = studentById.get(e.studentId);
      if (!student) continue;
      const list = studentsBySectionId.get(e.classSectionId) ?? [];
      // A student with two active enrollments in one section appears once.
      if (!list.some((s) => s.id === student.id)) list.push(student);
      studentsBySectionId.set(e.classSectionId, list);
    }

    return {
      sections: sections.map((s) => ({
        id: s.id,
        displayLabel: s.displayLabel,
        campusId: s.campusId,
      })),
      offeringsBySectionId,
      studentsBySectionId,
    };
  }

  // ======================= internals =======================

  private assertConfigurable(status: string) {
    if (status !== 'draft') {
      throw new BadRequestException(
        'Components and sections can only be changed while the cycle is a draft.',
      );
    }
  }

  private assertCycleScope(
    actor: ResultActor,
    cycle: { campusId: string | null },
  ) {
    this.accessScope.assertWithinScope(actor.grantScope, {
      campusId: cycle.campusId ?? undefined,
    });
  }

  /** Public campus-scope guard for sibling services (entry/publication). */
  assertAccess(actor: ResultActor, cycle: { campusId: string | null }) {
    this.assertCycleScope(actor, cycle);
  }

  private scopedCampusId(grantScope: ResultActor['grantScope']): string | null {
    if (!grantScope || grantScope.type !== 'campus') return null;
    if (!grantScope.value) {
      throw new ForbiddenException('A campus-scoped action needs a campus.');
    }
    return grantScope.value;
  }

  async loadCycle(tenantId: string, cycleId: string) {
    const cycle = await this.client.resultCycle.findFirst({
      where: { id: cycleId, tenantId },
    });
    if (!cycle) throw new NotFoundException('Result cycle not found');
    return cycle;
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

  private async assertTerm(tenantId: string, termId: string) {
    const term = await this.client.term.findFirst({
      where: { id: termId, tenantId },
      select: { id: true },
    });
    if (!term) throw new BadRequestException('Term not found for this tenant.');
  }

  private async assertYearLevel(tenantId: string, yearLevelId: string) {
    const yl = await this.client.yearLevel.findFirst({
      where: { id: yearLevelId, tenantId },
      select: { id: true },
    });
    if (!yl)
      throw new BadRequestException('Year level not found for this tenant.');
  }

  private async assertGradingSystem(tenantId: string, gradingSystemId: string) {
    const gs = await this.client.gradingSystem.findFirst({
      where: { id: gradingSystemId, tenantId },
      select: { id: true },
    });
    if (!gs)
      throw new BadRequestException(
        'Grading system not found for this tenant.',
      );
  }

  private async assertRuleSet(
    tenantId: string,
    ruleSetId: string,
    kind: 'subject' | 'principal',
  ) {
    const rs = await this.client.remarkRuleSet.findFirst({
      where: { id: ruleSetId, tenantId },
      select: { id: true, kind: true },
    });
    if (!rs)
      throw new BadRequestException(
        'Remark rule set not found for this tenant.',
      );
    if (rs.kind !== kind) {
      throw new BadRequestException(
        `Expected a ${kind} remark rule set but got a ${rs.kind} one.`,
      );
    }
  }
}

// Re-export for consumers that inject the scope type.
export type { ScopeDescriptor };
