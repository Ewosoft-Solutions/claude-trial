/**
 * WB4-3 · ResultTraitService — the affective / psychomotor rubric a cycle
 * carries beside its academic components, and the per-student ratings against
 * it (the behavioural domains a Nigerian report card shows under the subject
 * table).
 *
 * Two rules mirror the academic side: the rubric is only editable while the
 * cycle is a DRAFT (so ratings are never orphaned by a rubric change), and an
 * UNRATED trait is absent rather than the lowest rating — a blank is a blank,
 * never a silent 1. Traits never contribute to the academic total; they are
 * snapshotted alongside it at publish.
 */
import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@workspace/database';

import { TenantDbService } from '../../common/database/tenant-db.service';
import { AuditService } from '../../common/audit/audit.service';
import { AUDIT_EVENT } from '../../common/audit/audit.constants';
import { ResultCycleService } from './result-cycle.service';
import type { ResultActor } from './results.types';
import type { ConfigureTraitsDto, RateTraitsDto } from '../dto';

@Injectable()
export class ResultTraitService {
  constructor(
    private readonly tenantDb: TenantDbService,
    private readonly audit: AuditService,
    private readonly cycles: ResultCycleService,
  ) {}

  private get client(): Prisma.TransactionClient {
    return this.tenantDb.client;
  }

  /** The cycle's rubric, ordered for display (affective first, then order). */
  async listTraits(tenantId: string, actor: ResultActor, cycleId: string) {
    const cycle = await this.cycles.loadCycle(tenantId, cycleId);
    this.cycles.assertAccess(actor, cycle);
    return this.client.resultTrait.findMany({
      where: { tenantId, cycleId },
      orderBy: [{ domain: 'asc' }, { order: 'asc' }],
    });
  }

  /**
   * Replace the rubric wholesale. Draft-only (the same guard the component set
   * uses) so a rubric change can never strand ratings that were captured
   * against a trait that no longer exists.
   */
  async configureTraits(
    tenantId: string,
    actor: ResultActor,
    cycleId: string,
    dto: ConfigureTraitsDto,
  ) {
    const cycle = await this.cycles.loadCycle(tenantId, cycleId);
    this.cycles.assertAccess(actor, cycle);
    if (cycle.status !== 'draft') {
      throw new BadRequestException(
        'The trait rubric can only be changed while the cycle is a draft.',
      );
    }
    const keys = dto.traits.map((t) => t.key.trim());
    if (keys.some((k) => k.length === 0)) {
      throw new BadRequestException('A trait needs a key.');
    }
    if (new Set(keys).size !== keys.length) {
      throw new BadRequestException('Trait keys must be unique.');
    }

    // Cascade removes the ratings with the traits (draft-only, so there are
    // none in practice — this keeps the invariant true even if there were).
    await this.client.resultTrait.deleteMany({ where: { tenantId, cycleId } });
    if (dto.traits.length > 0) {
      await this.client.resultTrait.createMany({
        data: dto.traits.map((t, i) => ({
          tenantId,
          cycleId,
          domain: t.domain,
          key: t.key.trim(),
          label: t.label.trim(),
          maxRating: t.maxRating ?? 5,
          order: t.order ?? i,
        })),
      });
    }
    await this.audit.write({
      tenantId,
      eventType: AUDIT_EVENT.DATA_CHANGE,
      action: 'academics.results.cycle.traits',
      resource: 'result_cycle',
      resourceId: cycleId,
      actorId: actor.userId,
      description: `configured ${dto.traits.length} behavioural trait(s) on ${cycle.name}`,
      metadata: { traits: dto.traits.length },
    });
    return this.listTraits(tenantId, actor, cycleId);
  }

  /**
   * The rating grid for one section: the rubric, the section's students, and
   * whatever has been rated so far. Without a `sectionId` it returns the
   * section list so the UI can pick one (mirrors the score grid).
   */
  async getTraitGrid(
    tenantId: string,
    actor: ResultActor,
    cycleId: string,
    sectionId?: string,
  ) {
    const cycle = await this.cycles.loadCycle(tenantId, cycleId);
    this.cycles.assertAccess(actor, cycle);
    const [traits, scope] = await Promise.all([
      this.client.resultTrait.findMany({
        where: { tenantId, cycleId },
        orderBy: [{ domain: 'asc' }, { order: 'asc' }],
      }),
      this.cycles.resolveScope(tenantId, cycle),
    ]);
    const editable = cycle.status === 'entry_open';

    if (!sectionId) {
      return { cycle, traits, sections: scope.sections, editable };
    }
    const section = scope.sections.find((s) => s.id === sectionId);
    if (!section) {
      throw new BadRequestException('Section is not part of this cycle.');
    }
    const students = scope.studentsBySectionId.get(sectionId) ?? [];
    const studentIds = students.map((s) => s.id);
    const ratings =
      studentIds.length && traits.length
        ? await this.client.resultTraitRating.findMany({
            where: { tenantId, cycleId, studentId: { in: studentIds } },
            select: { studentId: true, traitId: true, rating: true },
          })
        : [];

    return { cycle, section, traits, students, editable, ratings };
  }

  /**
   * Upsert a batch of ratings. Entry-open only, every rating within its own
   * trait's scale, every student in the cycle's scope. A null rating CLEARS the
   * cell (back to unrated) rather than storing a zero.
   */
  async rateTraits(
    tenantId: string,
    actor: ResultActor,
    cycleId: string,
    dto: RateTraitsDto,
  ) {
    const cycle = await this.cycles.loadCycle(tenantId, cycleId);
    this.cycles.assertAccess(actor, cycle);
    if (cycle.status !== 'entry_open') {
      throw new BadRequestException('This cycle is not open for entry.');
    }
    if (dto.ratings.length === 0) return { upserted: 0 };

    const traits = await this.client.resultTrait.findMany({
      where: { tenantId, cycleId },
      select: { id: true, key: true, maxRating: true },
    });
    if (traits.length === 0) {
      throw new BadRequestException(
        'This cycle has no trait rubric to rate against.',
      );
    }
    const traitByKey = new Map(traits.map((t) => [t.key, t]));

    const scope = await this.cycles.resolveScope(tenantId, cycle);
    const inScope = new Set<string>();
    for (const students of scope.studentsBySectionId.values()) {
      for (const s of students) inScope.add(s.id);
    }

    let upserted = 0;
    for (const input of dto.ratings) {
      const trait = traitByKey.get(input.traitKey);
      if (!trait) {
        throw new BadRequestException(
          `Unknown trait "${input.traitKey}" for this cycle.`,
        );
      }
      if (!inScope.has(input.studentId)) {
        throw new BadRequestException(
          'A rating references a student not in this cycle.',
        );
      }
      const rating =
        input.rating === null || input.rating === undefined
          ? null
          : input.rating;
      if (rating !== null && rating > trait.maxRating) {
        throw new BadRequestException(
          `Rating ${rating} exceeds the ${trait.maxRating}-point scale for ${trait.key}.`,
        );
      }

      await this.client.resultTraitRating.upsert({
        where: {
          cycleId_studentId_traitId: {
            cycleId,
            studentId: input.studentId,
            traitId: trait.id,
          },
        },
        create: {
          tenantId,
          cycleId,
          traitId: trait.id,
          studentId: input.studentId,
          rating,
          ratedBy: actor.userId,
        },
        update: { rating, ratedBy: actor.userId, ratedAt: new Date() },
      });
      upserted += 1;
    }

    await this.audit.write({
      tenantId,
      eventType: AUDIT_EVENT.DATA_CHANGE,
      action: 'academics.results.traits.rate',
      resource: 'result_cycle',
      resourceId: cycleId,
      actorId: actor.userId,
      description: `rated ${upserted} behavioural cell(s) on ${cycle.name}`,
      metadata: { upserted },
    });
    return { upserted };
  }

  /**
   * The publish-time read: every student's rated traits for this cycle, keyed by
   * studentId. Only RATED traits are returned — an unrated trait is absent from
   * the snapshot, so a blank on the report card is provably a blank.
   */
  async snapshotRatingsByStudent(
    tenantId: string,
    cycleId: string,
  ): Promise<{
    rubric: {
      domain: string;
      key: string;
      label: string;
      maxRating: number;
      order: number;
    }[];
    byStudent: Map<
      string,
      {
        domain: string;
        key: string;
        label: string;
        rating: number;
        maxRating: number;
      }[]
    >;
  }> {
    const traits = await this.client.resultTrait.findMany({
      where: { tenantId, cycleId },
      orderBy: [{ domain: 'asc' }, { order: 'asc' }],
      select: {
        id: true,
        domain: true,
        key: true,
        label: true,
        maxRating: true,
        order: true,
      },
    });
    const rubric = traits.map((t) => ({
      domain: t.domain,
      key: t.key,
      label: t.label,
      maxRating: t.maxRating,
      order: t.order,
    }));
    const byStudent = new Map<
      string,
      {
        domain: string;
        key: string;
        label: string;
        rating: number;
        maxRating: number;
      }[]
    >();
    if (traits.length === 0) return { rubric, byStudent };

    const ratings = await this.client.resultTraitRating.findMany({
      where: { tenantId, cycleId, rating: { not: null } },
      select: { studentId: true, traitId: true, rating: true },
    });
    const traitById = new Map(traits.map((t) => [t.id, t]));
    // Rubric order drives the snapshot order so the same rubric always
    // serialises identically (the publication checksum depends on it).
    const orderOf = new Map(traits.map((t, i) => [t.id, i]));
    const grouped = new Map<string, typeof ratings>();
    for (const r of ratings) {
      const list = grouped.get(r.studentId) ?? [];
      list.push(r);
      grouped.set(r.studentId, list);
    }
    for (const [studentId, list] of grouped) {
      byStudent.set(
        studentId,
        list
          .slice()
          .sort(
            (a, b) =>
              (orderOf.get(a.traitId) ?? 0) - (orderOf.get(b.traitId) ?? 0),
          )
          .flatMap((r) => {
            const trait = traitById.get(r.traitId);
            if (!trait || r.rating === null) return [];
            return [
              {
                domain: trait.domain,
                key: trait.key,
                label: trait.label,
                rating: r.rating,
                maxRating: trait.maxRating,
              },
            ];
          }),
      );
    }
    return { rubric, byStudent };
  }
}
