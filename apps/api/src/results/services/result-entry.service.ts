/**
 * WB4 · ResultEntryService — direct capture of component scores per (student ·
 * subject offering · component) while a cycle is open for entry. Absent ≠ zero
 * (an absent/exempt cell stores no score). Optionally seeds empty cells from the
 * legacy gradebook (best-effort, fill-only — see seedFromGradebook).
 */
import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@workspace/database';

import { TenantDbService } from '../../common/database/tenant-db.service';
import { AuditService } from '../../common/audit/audit.service';
import { AUDIT_EVENT } from '../../common/audit/audit.constants';
import { ResultCycleService } from './result-cycle.service';
import type { ResultActor } from './results.types';
import type { SeedFromGradebookDto, UpsertResultEntriesDto } from '../dto';

@Injectable()
export class ResultEntryService {
  constructor(
    private readonly tenantDb: TenantDbService,
    private readonly audit: AuditService,
    private readonly cycles: ResultCycleService,
  ) {}

  private get client(): Prisma.TransactionClient {
    return this.tenantDb.client;
  }

  /**
   * The entry grid. With a `sectionId`, returns that section's students +
   * offerings + existing entries; without one, returns the section list +
   * components so the UI can pick a section.
   */
  async getGrid(
    tenantId: string,
    actor: ResultActor,
    cycleId: string,
    sectionId?: string,
  ) {
    const cycle = await this.cycles.loadCycle(tenantId, cycleId);
    this.cycles.assertAccess(actor, cycle);
    const components = await this.client.resultComponent.findMany({
      where: { tenantId, cycleId },
      orderBy: { order: 'asc' },
    });
    const scope = await this.cycles.resolveScope(tenantId, cycle);

    if (!sectionId) {
      return {
        cycle,
        components,
        sections: scope.sections,
        editable: cycle.status === 'entry_open',
      };
    }

    const section = scope.sections.find((s) => s.id === sectionId);
    if (!section) {
      throw new BadRequestException('Section is not part of this cycle.');
    }
    const students = scope.studentsBySectionId.get(sectionId) ?? [];
    const offerings = scope.offeringsBySectionId.get(sectionId) ?? [];
    const studentIds = students.map((s) => s.id);
    const offeringIds = offerings.map((o) => o.id);

    const entries =
      studentIds.length && offeringIds.length
        ? await this.client.resultEntry.findMany({
            where: {
              tenantId,
              cycleId,
              studentId: { in: studentIds },
              subjectOfferingId: { in: offeringIds },
            },
            select: {
              studentId: true,
              subjectOfferingId: true,
              componentId: true,
              score: true,
              isAbsent: true,
              isExempt: true,
            },
          })
        : [];

    return {
      cycle,
      section,
      components,
      students,
      offerings,
      editable: cycle.status === 'entry_open',
      entries: entries.map((e) => ({
        studentId: e.studentId,
        subjectOfferingId: e.subjectOfferingId,
        componentId: e.componentId,
        score: e.score === null ? null : Number(e.score),
        isAbsent: e.isAbsent,
        isExempt: e.isExempt,
      })),
    };
  }

  /**
   * Upsert a batch of component scores. The cycle must be open for entry; every
   * cell must reference an in-scope (student · offering) pair and a real
   * component, and a score must be within the component's max. Absent/exempt
   * cells store no score (absent ≠ zero).
   */
  async upsertEntries(
    tenantId: string,
    actor: ResultActor,
    cycleId: string,
    dto: UpsertResultEntriesDto,
  ) {
    const cycle = await this.cycles.loadCycle(tenantId, cycleId);
    this.cycles.assertAccess(actor, cycle);
    if (cycle.status !== 'entry_open') {
      throw new BadRequestException('This cycle is not open for entry.');
    }
    if (dto.entries.length === 0) return { upserted: 0 };

    const components = await this.client.resultComponent.findMany({
      where: { tenantId, cycleId },
      select: { id: true, key: true, maxScore: true },
    });
    const componentByKey = new Map(components.map((c) => [c.key, c]));

    // Build the valid (student, offering) set from the cycle scope.
    const scope = await this.cycles.resolveScope(tenantId, cycle);
    const validPairs = new Set<string>();
    for (const [sectionId, students] of scope.studentsBySectionId) {
      const offerings = scope.offeringsBySectionId.get(sectionId) ?? [];
      for (const s of students) {
        for (const o of offerings) validPairs.add(`${s.id}::${o.id}`);
      }
    }

    let upserted = 0;
    for (const input of dto.entries) {
      const component = componentByKey.get(input.componentKey);
      if (!component) {
        throw new BadRequestException(
          `Unknown component "${input.componentKey}" for this cycle.`,
        );
      }
      if (!validPairs.has(`${input.studentId}::${input.subjectOfferingId}`)) {
        throw new BadRequestException(
          'A score references a student/subject not in this cycle.',
        );
      }
      const isExempt = input.isExempt ?? false;
      const isAbsent = !isExempt && (input.isAbsent ?? false);
      let score: Prisma.Decimal | null = null;
      if (
        !isAbsent &&
        !isExempt &&
        input.score !== null &&
        input.score !== undefined
      ) {
        if (input.score > Number(component.maxScore)) {
          throw new BadRequestException(
            `Score ${input.score} exceeds the max ${component.maxScore} for ${input.componentKey}.`,
          );
        }
        score = new Prisma.Decimal(input.score);
      }

      await this.client.resultEntry.upsert({
        where: {
          cycleId_studentId_subjectOfferingId_componentId: {
            cycleId,
            studentId: input.studentId,
            subjectOfferingId: input.subjectOfferingId,
            componentId: component.id,
          },
        },
        create: {
          tenantId,
          cycleId,
          componentId: component.id,
          studentId: input.studentId,
          subjectOfferingId: input.subjectOfferingId,
          score,
          isAbsent,
          isExempt,
          enteredBy: actor.userId,
        },
        update: {
          score,
          isAbsent,
          isExempt,
          enteredBy: actor.userId,
          enteredAt: new Date(),
        },
      });
      upserted += 1;
    }

    await this.audit.write({
      tenantId,
      eventType: AUDIT_EVENT.DATA_CHANGE,
      action: 'academics.results.entry.upsert',
      resource: 'result_cycle',
      resourceId: cycleId,
      actorId: actor.userId,
      description: `entered ${upserted} result cells on ${cycle.name}`,
      metadata: { upserted },
    });
    return { upserted };
  }

  /**
   * Best-effort seed of EMPTY cells from the legacy gradebook. The legacy
   * Grade/Assessment gradebook (keyed on Class/Course) is not structurally joined
   * to the WB2 SubjectOffering, so this matches by subject NAME (course
   * subject/name ↔ offering label, case-insensitive) and writes the student's
   * aggregate percentage of that course into the chosen component — filling only
   * cells that have no entry yet (it never overwrites a keyed-in score). Returns
   * what it seeded and what it could not match, so it is auditable, not magic.
   */
  async seedFromGradebook(
    tenantId: string,
    actor: ResultActor,
    cycleId: string,
    dto: SeedFromGradebookDto,
  ) {
    const cycle = await this.cycles.loadCycle(tenantId, cycleId);
    this.cycles.assertAccess(actor, cycle);
    if (cycle.status !== 'entry_open') {
      throw new BadRequestException('This cycle is not open for entry.');
    }
    const components = await this.client.resultComponent.findMany({
      where: { tenantId, cycleId },
      orderBy: { order: 'asc' },
    });
    if (components.length === 0) {
      throw new BadRequestException('Configure components before seeding.');
    }
    const targetComponent = dto.componentKey
      ? components.find((c) => c.key === dto.componentKey)
      : components[0];
    if (!targetComponent) {
      throw new BadRequestException(
        `Unknown component "${dto.componentKey}" for this cycle.`,
      );
    }

    const scope = await this.cycles.resolveScope(tenantId, cycle);
    const wantOfferings = dto.subjectOfferingIds
      ? new Set(dto.subjectOfferingIds)
      : null;

    // Collect the in-scope students + offerings (optionally filtered).
    const studentIds = new Set<string>();
    const offeringLabelById = new Map<string, string>();
    for (const [sectionId, students] of scope.studentsBySectionId) {
      for (const s of students) studentIds.add(s.id);
      for (const o of scope.offeringsBySectionId.get(sectionId) ?? []) {
        if (!wantOfferings || wantOfferings.has(o.id)) {
          offeringLabelById.set(o.id, o.subjectLabel.trim().toLowerCase());
        }
      }
    }
    if (studentIds.size === 0 || offeringLabelById.size === 0) {
      return {
        seeded: 0,
        skippedExisting: 0,
        unmatchedSubjects: [] as string[],
      };
    }

    // Pull the student's legacy grades for this year/term, grouped by course.
    const grades = await this.client.grade.findMany({
      where: {
        tenantId,
        enrollment: {
          studentId: { in: [...studentIds] },
          academicYearId: cycle.academicYearId,
          ...(cycle.termId ? { termId: cycle.termId } : {}),
        },
        percentage: { not: null },
      },
      select: {
        percentage: true,
        enrollment: {
          select: {
            studentId: true,
            class: {
              select: { course: { select: { subject: true, name: true } } },
            },
          },
        },
      },
    });

    // Average percentage per (student, courseLabel).
    const acc = new Map<string, { sum: number; n: number }>();
    for (const g of grades) {
      const studentId = g.enrollment?.studentId;
      const course = g.enrollment?.class?.course;
      const label = (course?.subject || course?.name || '')
        .trim()
        .toLowerCase();
      if (!studentId || !label || g.percentage === null) continue;
      const key = `${studentId}::${label}`;
      const cur = acc.get(key) ?? { sum: 0, n: 0 };
      cur.sum += Number(g.percentage);
      cur.n += 1;
      acc.set(key, cur);
    }

    // Existing entries for the target component (fill-only guard).
    const existing = await this.client.resultEntry.findMany({
      where: { tenantId, cycleId, componentId: targetComponent.id },
      select: { studentId: true, subjectOfferingId: true },
    });
    const filled = new Set(
      existing.map((e) => `${e.studentId}::${e.subjectOfferingId}`),
    );

    let seeded = 0;
    let skippedExisting = 0;
    const unmatched = new Set<string>();
    const max = Number(targetComponent.maxScore);

    for (const [sectionId, students] of scope.studentsBySectionId) {
      for (const s of students) {
        for (const o of scope.offeringsBySectionId.get(sectionId) ?? []) {
          if (wantOfferings && !wantOfferings.has(o.id)) continue;
          if (filled.has(`${s.id}::${o.id}`)) {
            skippedExisting += 1;
            continue;
          }
          const label = o.subjectLabel.trim().toLowerCase();
          const stat = acc.get(`${s.id}::${label}`);
          if (!stat || stat.n === 0) {
            unmatched.add(o.subjectLabel);
            continue;
          }
          const pct = stat.sum / stat.n;
          const score = Math.min(
            max,
            Math.round((pct / 100) * max * 100) / 100,
          );
          await this.client.resultEntry.create({
            data: {
              tenantId,
              cycleId,
              componentId: targetComponent.id,
              studentId: s.id,
              subjectOfferingId: o.id,
              score: new Prisma.Decimal(score),
              enteredBy: actor.userId,
            },
          });
          seeded += 1;
        }
      }
    }

    await this.audit.write({
      tenantId,
      eventType: AUDIT_EVENT.DATA_CHANGE,
      action: 'academics.results.entry.seed',
      resource: 'result_cycle',
      resourceId: cycleId,
      actorId: actor.userId,
      description: `seeded ${seeded} cells from the gradebook into ${targetComponent.key}`,
      metadata: { seeded, skippedExisting, component: targetComponent.key },
    });
    return {
      seeded,
      skippedExisting,
      unmatchedSubjects: [...unmatched],
    };
  }
}
