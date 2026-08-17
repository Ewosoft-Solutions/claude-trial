/**
 * Academic-structure model service (WB2-1 · ADR-02)
 *
 * The structured replacement for the labeled-bag `Class`/`Course` + name
 * parsing. Stores the structure as DIMENSIONS — Stage → YearLevel → ClassSection
 * (on a Campus) ← Stream — plus SubjectOffering (an F6 CurriculumSubject offered
 * to a section in a year/term). Two cohorts "SS1 SCIENCE" and "SS1 ARTS" are two
 * ClassSection rows sharing a YearLevel and differing only by Stream. The
 * `displayLabel` is COMPOSED here from the dimensions and stored; NO method ever
 * parses stage/year/stream back out of a label.
 *
 * Runs on the request's tenant-scoped client (RLS; no privileged client — the
 * controller is @TenantScoped). Campus scope is ENFORCED via the WB1-6
 * `AccessScopeService`: a campus-scoped actor may only touch sections on its own
 * campus (ClassSection.campusId is the target).
 */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { matchLevelCode, Prisma } from '@workspace/database';

import { TenantDbService } from '../../common/database/tenant-db.service';
import { AuditService } from '../../common/audit/audit.service';
import { AUDIT_EVENT } from '../../common/audit/audit.constants';
import {
  AccessScopeService,
  type ScopeDescriptor,
} from '../../auth/services/access-scope.service';
import type {
  CreateStageDto,
  UpdateStageDto,
  CreateYearLevelDto,
  UpdateYearLevelDto,
  CreateStreamDto,
  UpdateStreamDto,
  CreateClassSectionDto,
  UpdateClassSectionDto,
  CreateSubjectOfferingDto,
  UpdateSubjectOfferingDto,
  ListYearLevelsDto,
  ListClassSectionsDto,
  ListSubjectOfferingsDto,
} from '../dto';

/** Who is acting on the academic structure + how wide their scope reaches. */
export interface StructureActor {
  userId: string;
  /** The campus scope of the actor's role grant (WB1-6); null = unscoped. */
  grantScope?: ScopeDescriptor | null;
}

/**
 * Compose a stored display label from the structure's dimensions. This is the
 * inverse of the incumbent's sin: we BUILD a label from parts, we never parse a
 * label to recover the parts. e.g. ("SS1", "Science", "A") → "SS1 Science A";
 * ("JSS1", null, "Gold") → "JSS1 Gold".
 */
export function composeSectionLabel(
  yearLevelName: string,
  streamName: string | null | undefined,
  sectionName: string,
): string {
  return [yearLevelName, streamName, sectionName]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(' ');
}

@Injectable()
export class AcademicStructureModelService {
  constructor(
    private readonly tenantDb: TenantDbService,
    private readonly audit: AuditService,
    private readonly accessScope: AccessScopeService,
  ) {}

  private get client(): Prisma.TransactionClient {
    return this.tenantDb.client;
  }

  /**
   * The campus a scoped READ is clamped to, or null when unrestricted. A
   * `campus`-scoped actor only ever sees their own campus's rows, so their
   * scope's campus OVERRIDES any client-supplied campus filter (the read-path
   * twin of the write-path `assertWithinScope`); an unscoped/`global`/unknown
   * scope is unclamped. Mirrors AccessScopeService's campus rule — including
   * failing CLOSED: a `campus` scope with no campus is denied (rather than
   * falling through to see everything), same as the write path.
   */
  private scopedCampusId(
    grantScope: ScopeDescriptor | null | undefined,
  ): string | null {
    if (!grantScope || grantScope.type !== 'campus') return null;
    if (!grantScope.value) {
      throw new ForbiddenException('A campus-scoped action needs a campus.');
    }
    return grantScope.value;
  }

  private async writeAudit(
    tenantId: string,
    actorId: string,
    action: string,
    resource: string,
    resourceId: string,
    description: string,
    metadata?: Record<string, unknown>,
  ) {
    await this.audit.write({
      tenantId,
      eventType: AUDIT_EVENT.DATA_CHANGE,
      action,
      resource,
      resourceId,
      actorId,
      description,
      metadata,
    });
  }

  // ======================= Stage =======================

  async createStage(tenantId: string, actorId: string, dto: CreateStageDto) {
    await this.assertUniqueCode('stage', tenantId, dto.code);
    const stage = await this.client.stage.create({
      data: {
        tenantId,
        name: dto.name.trim(),
        code: dto.code.trim(),
        educationLevel: dto.educationLevel ?? null,
        order: dto.order ?? 0,
        createdBy: actorId,
      },
    });
    await this.writeAudit(
      tenantId,
      actorId,
      'academics.structure.stage.create',
      'stage',
      stage.id,
      `created stage ${stage.name}`,
    );
    return stage;
  }

  async listStages(tenantId: string) {
    return this.client.stage.findMany({
      where: { tenantId },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
    });
  }

  async updateStage(
    tenantId: string,
    actorId: string,
    id: string,
    dto: UpdateStageDto,
  ) {
    await this.loadOr404('stage', tenantId, id);
    const stage = await this.client.stage.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        order: dto.order,
        status: dto.status,
        updatedBy: actorId,
      },
    });
    await this.writeAudit(
      tenantId,
      actorId,
      'academics.structure.stage.update',
      'stage',
      id,
      `updated stage ${stage.name}`,
    );
    return stage;
  }

  // ======================= YearLevel =======================

  async createYearLevel(
    tenantId: string,
    actorId: string,
    dto: CreateYearLevelDto,
  ) {
    const stage = await this.client.stage.findFirst({
      where: { id: dto.stageId, tenantId },
      select: { id: true },
    });
    if (!stage)
      throw new BadRequestException('Stage not found for this tenant.');
    await this.assertUniqueCode('yearLevel', tenantId, dto.code);
    const yearLevel = await this.client.yearLevel.create({
      data: {
        tenantId,
        stageId: dto.stageId,
        name: dto.name.trim(),
        code: dto.code.trim(),
        // The school's own name goes in `name`; the fixed national rung goes in
        // `levelCode`. When the caller omits the code we try to infer it from
        // the name they typed — a best-effort convenience, never a guess that
        // overrides an explicit choice.
        levelCode: dto.levelCode ?? matchLevelCode(dto.name) ?? null,
        order: dto.order ?? 0,
        createdBy: actorId,
      },
    });
    await this.writeAudit(
      tenantId,
      actorId,
      'academics.structure.year_level.create',
      'year_level',
      yearLevel.id,
      `created year level ${yearLevel.name}`,
    );
    return yearLevel;
  }

  async listYearLevels(tenantId: string, query: ListYearLevelsDto) {
    return this.client.yearLevel.findMany({
      where: { tenantId, ...(query.stageId ? { stageId: query.stageId } : {}) },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
    });
  }

  async updateYearLevel(
    tenantId: string,
    actorId: string,
    id: string,
    dto: UpdateYearLevelDto,
  ) {
    await this.loadOr404('yearLevel', tenantId, id);
    const yearLevel = await this.client.yearLevel.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        order: dto.order,
        status: dto.status,
        updatedBy: actorId,
      },
    });
    await this.writeAudit(
      tenantId,
      actorId,
      'academics.structure.year_level.update',
      'year_level',
      id,
      `updated year level ${yearLevel.name}`,
    );
    return yearLevel;
  }

  // ======================= Stream =======================

  async createStream(tenantId: string, actorId: string, dto: CreateStreamDto) {
    await this.assertUniqueCode('stream', tenantId, dto.code);
    const stream = await this.client.stream.create({
      data: {
        tenantId,
        name: dto.name.trim(),
        code: dto.code.trim(),
        description: dto.description?.trim() || null,
        aliases: (dto.aliases ?? []).map((a) => a.trim()).filter(Boolean),
        order: dto.order ?? 0,
        createdBy: actorId,
      },
    });
    await this.writeAudit(
      tenantId,
      actorId,
      'academics.structure.stream.create',
      'stream',
      stream.id,
      `created stream ${stream.name}`,
    );
    return stream;
  }

  async listStreams(tenantId: string) {
    return this.client.stream.findMany({
      where: { tenantId },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
    });
  }

  async updateStream(
    tenantId: string,
    actorId: string,
    id: string,
    dto: UpdateStreamDto,
  ) {
    await this.loadOr404('stream', tenantId, id);
    const stream = await this.client.stream.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        order: dto.order,
        status: dto.status,
        updatedBy: actorId,
      },
    });
    await this.writeAudit(
      tenantId,
      actorId,
      'academics.structure.stream.update',
      'stream',
      id,
      `updated stream ${stream.name}`,
    );
    return stream;
  }

  // ======================= ClassSection =======================

  async createClassSection(
    tenantId: string,
    actor: StructureActor,
    dto: CreateClassSectionDto,
  ) {
    // Campus scope: a campus-scoped actor can only build sections on its campus.
    this.accessScope.assertWithinScope(actor.grantScope, {
      campusId: dto.campusId,
    });

    const campus = await this.client.campus.findFirst({
      where: { id: dto.campusId, tenantId },
      select: { id: true },
    });
    if (!campus)
      throw new BadRequestException('Campus not found for this tenant.');

    const yearLevel = await this.client.yearLevel.findFirst({
      where: { id: dto.yearLevelId, tenantId },
      select: { id: true, name: true },
    });
    if (!yearLevel)
      throw new BadRequestException('Year level not found for this tenant.');

    let streamName: string | null = null;
    if (dto.streamId) {
      const stream = await this.client.stream.findFirst({
        where: { id: dto.streamId, tenantId },
        select: { id: true, name: true },
      });
      if (!stream)
        throw new BadRequestException('Stream not found for this tenant.');
      streamName = stream.name;
    }

    const name = dto.name.trim();
    // Dedupe (Postgres treats NULL stream as distinct in the unique index).
    const dup = await this.client.classSection.findFirst({
      where: {
        tenantId,
        campusId: dto.campusId,
        yearLevelId: dto.yearLevelId,
        streamId: dto.streamId ?? null,
        name,
      },
      select: { id: true },
    });
    if (dup) {
      throw new ConflictException(
        'A class section with this campus, year, stream and name already exists.',
      );
    }

    const displayLabel = composeSectionLabel(yearLevel.name, streamName, name);
    const section = await this.client.classSection.create({
      data: {
        tenantId,
        campusId: dto.campusId,
        yearLevelId: dto.yearLevelId,
        streamId: dto.streamId ?? null,
        name,
        displayLabel,
        capacity: dto.capacity ?? 30,
        createdBy: actor.userId,
      },
    });
    await this.writeAudit(
      tenantId,
      actor.userId,
      'academics.structure.class_section.create',
      'class_section',
      section.id,
      `created class section ${displayLabel}`,
      {
        campusId: dto.campusId,
        yearLevelId: dto.yearLevelId,
        streamId: dto.streamId ?? null,
      },
    );
    return section;
  }

  async listClassSections(
    tenantId: string,
    actor: StructureActor,
    query: ListClassSectionsDto,
  ) {
    // Campus scope on the READ path: a campus-scoped registrar sees only their
    // own campus's sections, clamping (overriding) any client `campusId` filter.
    const clampCampusId = this.scopedCampusId(actor.grantScope);
    return this.client.classSection.findMany({
      where: {
        tenantId,
        ...(clampCampusId
          ? { campusId: clampCampusId }
          : query.campusId
            ? { campusId: query.campusId }
            : {}),
        ...(query.yearLevelId ? { yearLevelId: query.yearLevelId } : {}),
        ...(query.streamId ? { streamId: query.streamId } : {}),
      },
      include: {
        yearLevel: { select: { id: true, name: true, code: true } },
        stream: { select: { id: true, name: true, code: true } },
      },
      orderBy: [{ displayLabel: 'asc' }],
    });
  }

  async updateClassSection(
    tenantId: string,
    actor: StructureActor,
    id: string,
    dto: UpdateClassSectionDto,
  ) {
    const existing = await this.client.classSection.findFirst({
      where: { id, tenantId },
      include: { yearLevel: { select: { name: true } } },
    });
    if (!existing) throw new NotFoundException('Class section not found');

    // Enforce scope against the section's OWN campus (an actor can't edit a
    // section outside their campus).
    this.accessScope.assertWithinScope(actor.grantScope, {
      campusId: existing.campusId,
    });

    // Resolve the (possibly changed) stream to recompose the stored label.
    let streamName: string | null = null;
    const nextStreamId =
      dto.streamId !== undefined ? dto.streamId : existing.streamId;
    if (nextStreamId) {
      const stream = await this.client.stream.findFirst({
        where: { id: nextStreamId, tenantId },
        select: { name: true },
      });
      if (!stream)
        throw new BadRequestException('Stream not found for this tenant.');
      streamName = stream.name;
    }
    const nextName = dto.name?.trim() ?? existing.name;
    const displayLabel = composeSectionLabel(
      existing.yearLevel.name,
      streamName,
      nextName,
    );

    // Pre-check the (campus, year, stream, name) uniqueness against OTHER rows so
    // a rename/re-stream into a collision returns a 409 — not a raw Prisma P2002
    // surfaced as a 500 (mirrors createClassSection's dedupe check).
    const dup = await this.client.classSection.findFirst({
      where: {
        id: { not: id },
        tenantId,
        campusId: existing.campusId,
        yearLevelId: existing.yearLevelId,
        streamId: nextStreamId ?? null,
        name: nextName,
      },
      select: { id: true },
    });
    if (dup) {
      throw new ConflictException(
        'A class section with this campus, year, stream and name already exists.',
      );
    }

    const section = await this.client.classSection.update({
      where: { id },
      data: {
        streamId: nextStreamId,
        name: nextName,
        displayLabel,
        capacity: dto.capacity,
        status: dto.status,
        updatedBy: actor.userId,
      },
    });
    await this.writeAudit(
      tenantId,
      actor.userId,
      'academics.structure.class_section.update',
      'class_section',
      id,
      `updated class section ${displayLabel}`,
    );
    return section;
  }

  // ======================= SubjectOffering =======================

  async createSubjectOffering(
    tenantId: string,
    actor: StructureActor,
    dto: CreateSubjectOfferingDto,
  ) {
    const section = await this.client.classSection.findFirst({
      where: { id: dto.classSectionId, tenantId },
      select: { id: true, campusId: true },
    });
    if (!section)
      throw new BadRequestException('Class section not found for this tenant.');

    // Scope: the offering targets a section on a campus.
    this.accessScope.assertWithinScope(actor.grantScope, {
      campusId: section.campusId,
    });

    const [academicYear, term, subject] = await Promise.all([
      this.client.academicYear.findFirst({
        where: { id: dto.academicYearId, tenantId },
        select: { id: true },
      }),
      dto.termId
        ? this.client.term.findFirst({
            where: { id: dto.termId, tenantId },
            select: { id: true },
          })
        : Promise.resolve(null),
      // curriculum_subjects is nullable-tenant (shared national + own); RLS on
      // the scoped client already restricts to visible rows, so a plain findFirst
      // resolves a shared or own subject and null otherwise.
      this.client.curriculumSubject.findFirst({
        where: { id: dto.curriculumSubjectId },
        select: { id: true, name: true, canonicalName: true },
      }),
    ]);
    if (!academicYear)
      throw new BadRequestException('Academic year not found for this tenant.');
    if (dto.termId && !term)
      throw new BadRequestException('Term not found for this tenant.');
    if (!subject)
      throw new BadRequestException(
        'Curriculum subject not found or not visible.',
      );

    // Dedupe (NULL term is distinct in the unique index).
    const dup = await this.client.subjectOffering.findFirst({
      where: {
        classSectionId: dto.classSectionId,
        curriculumSubjectId: dto.curriculumSubjectId,
        termId: dto.termId ?? null,
      },
      select: { id: true },
    });
    if (dup) {
      throw new ConflictException(
        'This subject is already offered to this section for that term.',
      );
    }

    const offering = await this.client.subjectOffering.create({
      data: {
        tenantId,
        classSectionId: dto.classSectionId,
        academicYearId: dto.academicYearId,
        termId: dto.termId ?? null,
        curriculumSubjectId: dto.curriculumSubjectId,
        subjectLabel: subject.canonicalName ?? subject.name,
        isElective: dto.isElective ?? false,
        createdBy: actor.userId,
      },
    });
    await this.writeAudit(
      tenantId,
      actor.userId,
      'academics.structure.subject_offering.create',
      'subject_offering',
      offering.id,
      `offered subject ${offering.subjectLabel} to section ${dto.classSectionId}`,
      {
        classSectionId: dto.classSectionId,
        curriculumSubjectId: dto.curriculumSubjectId,
      },
    );
    return offering;
  }

  async listSubjectOfferings(
    tenantId: string,
    actor: StructureActor,
    query: ListSubjectOfferingsDto,
  ) {
    // Offerings carry no campusId of their own — clamp a campus-scoped read
    // through the parent section's campus so a registrar sees only their campus.
    const clampCampusId = this.scopedCampusId(actor.grantScope);
    return this.client.subjectOffering.findMany({
      where: {
        tenantId,
        ...(query.classSectionId
          ? { classSectionId: query.classSectionId }
          : {}),
        ...(query.academicYearId
          ? { academicYearId: query.academicYearId }
          : {}),
        ...(clampCampusId ? { classSection: { campusId: clampCampusId } } : {}),
      },
      orderBy: [{ subjectLabel: 'asc' }],
    });
  }

  /**
   * The curriculum subjects a section can be offered, for the offering picker.
   *
   * Deliberately served from the STRUCTURE domain rather than sending the client
   * to the curriculum module: offering a subject is `academics.structure.manage`
   * work, and a registrar who can build sections should not also need
   * `curriculum.view` just to populate a dropdown. `curriculum_subjects` carries
   * a nullable tenant_id (shared national rows + own), so the RLS-scoped client
   * already returns exactly the rows this tenant may see.
   */
  async listOfferableSubjects() {
    const subjects = await this.client.curriculumSubject.findMany({
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        code: true,
        name: true,
        tenantId: true,
        version: {
          select: { id: true, versionLabel: true, approvalState: true },
        },
      },
    });
    return subjects.map((s) => ({
      id: s.id,
      code: s.code,
      name: s.name,
      versionId: s.version?.id ?? null,
      versionName: s.version?.versionLabel ?? null,
      versionState: s.version?.approvalState ?? null,
      /** National (shared) content this tenant reads but cannot edit. */
      isShared: s.tenantId === null,
    }));
  }

  async updateSubjectOffering(
    tenantId: string,
    actor: StructureActor,
    id: string,
    dto: UpdateSubjectOfferingDto,
  ) {
    const existing = await this.client.subjectOffering.findFirst({
      where: { id, tenantId },
      select: {
        id: true,
        subjectLabel: true,
        classSection: { select: { campusId: true } },
      },
    });
    if (!existing) throw new NotFoundException('Subject offering not found');

    this.accessScope.assertWithinScope(actor.grantScope, {
      campusId: existing.classSection.campusId,
    });

    const offering = await this.client.subjectOffering.update({
      where: { id },
      data: {
        isElective: dto.isElective,
        status: dto.status,
        updatedBy: actor.userId,
      },
    });
    await this.writeAudit(
      tenantId,
      actor.userId,
      'academics.structure.subject_offering.update',
      'subject_offering',
      id,
      `updated subject offering ${existing.subjectLabel}`,
    );
    return offering;
  }

  // ======================= Read: explain the structure =======================

  /**
   * The full campus structure tree: year levels → sections (with stream +
   * offerings). Backs the guided class-builder and the "explain a placement"
   * read. A campus-scoped actor may only view its own campus.
   */
  async getCampusStructure(
    tenantId: string,
    actor: StructureActor,
    campusId: string,
  ) {
    this.accessScope.assertWithinScope(actor.grantScope, { campusId });
    const campus = await this.client.campus.findFirst({
      where: { id: campusId, tenantId },
      select: { id: true, name: true, code: true },
    });
    if (!campus) throw new NotFoundException('Campus not found');

    const sections = await this.client.classSection.findMany({
      where: { tenantId, campusId },
      include: {
        yearLevel: {
          select: {
            id: true,
            name: true,
            code: true,
            order: true,
            stageId: true,
          },
        },
        stream: { select: { id: true, name: true, code: true } },
        subjectOfferings: {
          select: {
            id: true,
            subjectLabel: true,
            isElective: true,
            status: true,
            curriculumSubjectId: true,
          },
        },
      },
      orderBy: [{ displayLabel: 'asc' }],
    });

    return { campus, sections };
  }

  // ======================= helpers =======================

  private async assertUniqueCode(
    kind: 'stage' | 'yearLevel' | 'stream',
    tenantId: string,
    code: string,
  ) {
    const trimmed = code.trim();
    const where = { tenantId, code: trimmed };
    const existing =
      kind === 'stage'
        ? await this.client.stage.findFirst({ where, select: { id: true } })
        : kind === 'yearLevel'
          ? await this.client.yearLevel.findFirst({
              where,
              select: { id: true },
            })
          : await this.client.stream.findFirst({ where, select: { id: true } });
    if (existing) {
      throw new ConflictException(
        `A ${kind} with code "${trimmed}" already exists.`,
      );
    }
  }

  private async loadOr404(
    kind: 'stage' | 'yearLevel' | 'stream',
    tenantId: string,
    id: string,
  ) {
    const where = { id, tenantId };
    const found =
      kind === 'stage'
        ? await this.client.stage.findFirst({ where, select: { id: true } })
        : kind === 'yearLevel'
          ? await this.client.yearLevel.findFirst({
              where,
              select: { id: true },
            })
          : await this.client.stream.findFirst({ where, select: { id: true } });
    if (!found) {
      throw new NotFoundException(`${kind} not found`);
    }
  }
}
