/**
 * Alignment step 2 · the lesson LIBRARY and its per-class instances.
 *
 * The owner's decision was BOTH halves, and the split is the whole design:
 *
 *   library   — a `Lesson` authored once against an F6 curriculum subject,
 *               optionally grouped into a `LessonChapter`. Its body, materials,
 *               chunks and embeddings are computed once and shared.
 *   instance  — a `LessonInstance` binding one library lesson to one
 *               `SubjectOffering` (section × subject × year/term). This is where
 *               per-class reality lives: when it is scheduled, whether this arm
 *               has taught it, and any local note or title override.
 *
 * A school with four arms therefore authors once and instantiates four times,
 * instead of re-authoring — and, critically, the same PDF is never extracted and
 * embedded four times over.
 *
 * Access: a library lesson has no class, so the WB1-era class-teacher check
 * cannot scope it. The rule here is `lessons.manage.all`, OR the actor teaches
 * at least one offering of that curriculum subject — see assertCanManageLibrary.
 */
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { TenantDbService } from '../../common/database/tenant-db.service';
import { AuditService } from '../../common/audit/audit.service';
import { AUDIT_EVENT } from '../../common/audit/audit.constants';
import {
  AcademicsAccessService,
  type AcademicsActor,
} from '../../common/academics/academics-access.service';
import type {
  CreateLessonChapterDto,
  CreateLessonInstanceDto,
  UpdateLessonChapterDto,
  UpdateLessonInstanceDto,
} from '../dto/lesson-library.dto';

const INSTANCE_STATUSES = ['planned', 'taught', 'skipped'] as const;

@Injectable()
export class LessonLibraryService {
  constructor(
    private readonly tenantDb: TenantDbService,
    private readonly audit: AuditService,
    private readonly access: AcademicsAccessService,
  ) {}

  private get client() {
    return this.tenantDb.client;
  }

  private scoped<T>(
    tenantId: string,
    userId: string | undefined,
    fn: () => Promise<T>,
  ): Promise<T> {
    return this.tenantDb.runScoped(tenantId, userId, fn);
  }

  private async writeAudit(
    tenantId: string,
    actorId: string,
    action: string,
    resource: string,
    resourceId: string,
    description: string,
  ) {
    await this.audit.write({
      tenantId,
      eventType: AUDIT_EVENT.DATA_CHANGE,
      action,
      resource,
      resourceId,
      actorId,
      description,
    });
  }

  /** The F6 subject is a soft reference, so prove it exists and is visible. */
  private async assertCurriculumSubject(curriculumSubjectId: string) {
    // curriculum_subjects carries a nullable tenant_id (shared national rows +
    // own), and the RLS-scoped client already limits this read to what the
    // tenant may see — so a plain lookup is the correct visibility check.
    const subject = await this.client.curriculumSubject.findFirst({
      where: { id: curriculumSubjectId },
      select: { id: true },
    });
    if (!subject) {
      throw new BadRequestException(
        'Curriculum subject not found or not visible to this school.',
      );
    }
  }

  // ============================================================ chapters

  async listChapters(
    tenantId: string,
    actor: AcademicsActor,
    curriculumSubjectId?: string,
  ) {
    return this.scoped(tenantId, actor.userId, () =>
      this.client.lessonChapter.findMany({
        where: {
          tenantId,
          ...(curriculumSubjectId ? { curriculumSubjectId } : {}),
        },
        orderBy: [{ order: 'asc' }, { title: 'asc' }],
        include: {
          _count: { select: { lessons: true } },
        },
      }),
    );
  }

  async createChapter(
    tenantId: string,
    actor: AcademicsActor,
    dto: CreateLessonChapterDto,
  ) {
    return this.scoped(tenantId, actor.userId, async () => {
      await this.assertCurriculumSubject(dto.curriculumSubjectId);
      await this.access.assertCanManageCurriculumSubject(
        tenantId,
        actor,
        dto.curriculumSubjectId,
      );
      const chapter = await this.client.lessonChapter.create({
        data: {
          tenantId,
          curriculumSubjectId: dto.curriculumSubjectId,
          title: dto.title.trim(),
          description: dto.description?.trim() || null,
          thumbnailKey: dto.thumbnailKey ?? null,
          order: dto.order ?? 0,
          createdBy: actor.userId,
        },
      });
      await this.writeAudit(
        tenantId,
        actor.userId,
        'learning.chapter.create',
        'lesson_chapter',
        chapter.id,
        `created chapter ${chapter.title}`,
      );
      return chapter;
    });
  }

  async updateChapter(
    tenantId: string,
    actor: AcademicsActor,
    id: string,
    dto: UpdateLessonChapterDto,
  ) {
    return this.scoped(tenantId, actor.userId, async () => {
      const existing = await this.client.lessonChapter.findFirst({
        where: { id, tenantId },
        select: { id: true, curriculumSubjectId: true, title: true },
      });
      if (!existing) throw new NotFoundException('Chapter not found');
      await this.access.assertCanManageCurriculumSubject(
        tenantId,
        actor,
        existing.curriculumSubjectId,
      );
      const chapter = await this.client.lessonChapter.update({
        where: { id },
        data: {
          title: dto.title?.trim(),
          description:
            dto.description === undefined
              ? undefined
              : dto.description?.trim() || null,
          thumbnailKey: dto.thumbnailKey,
          order: dto.order,
          status: dto.status,
          updatedBy: actor.userId,
        },
      });
      await this.writeAudit(
        tenantId,
        actor.userId,
        'learning.chapter.update',
        'lesson_chapter',
        id,
        `updated chapter ${chapter.title}`,
      );
      return chapter;
    });
  }

  // ============================================================ instances

  /**
   * What a class is taught. Returns the offering's instances with the library
   * lesson they point at, so a caller renders one list without re-joining.
   */
  async listInstancesForOffering(
    tenantId: string,
    actor: AcademicsActor,
    subjectOfferingId: string,
  ) {
    return this.scoped(tenantId, actor.userId, () =>
      this.client.lessonInstance.findMany({
        where: { tenantId, subjectOfferingId },
        orderBy: [{ order: 'asc' }, { scheduledFor: 'asc' }],
        include: {
          lesson: {
            select: {
              id: true,
              title: true,
              description: true,
              thumbnailKey: true,
              status: true,
              reviewStatus: true,
              chapterId: true,
              curriculumSubjectId: true,
            },
          },
        },
      }),
    );
  }

  /**
   * Instantiate a library lesson for one class. Deliberately NOT a copy: the
   * body, materials and embeddings stay in the library, and only per-class
   * facts live here — which is what stops four arms re-embedding one PDF.
   */
  async createInstance(
    tenantId: string,
    actor: AcademicsActor,
    dto: CreateLessonInstanceDto,
  ) {
    return this.scoped(tenantId, actor.userId, async () => {
      const lesson = await this.client.lesson.findFirst({
        where: { id: dto.lessonId, tenantId },
        select: { id: true, title: true, curriculumSubjectId: true },
      });
      if (!lesson) throw new NotFoundException('Lesson not found');
      if (!lesson.curriculumSubjectId) {
        throw new BadRequestException(
          'This lesson is not in the library yet — give it a curriculum subject before scheduling it for a class.',
        );
      }

      const offering = await this.client.subjectOffering.findFirst({
        where: { id: dto.subjectOfferingId, tenantId },
        select: { id: true, curriculumSubjectId: true, subjectLabel: true },
      });
      if (!offering) {
        throw new BadRequestException('Subject offering not found.');
      }
      // A Maths lesson has no business on an English offering — the mismatch is
      // almost always a picker mistake, and silently allowing it would scatter
      // content across subjects.
      if (offering.curriculumSubjectId !== lesson.curriculumSubjectId) {
        throw new BadRequestException(
          `This lesson belongs to a different subject than ${offering.subjectLabel}.`,
        );
      }
      await this.access.assertCanManageCurriculumSubject(
        tenantId,
        actor,
        lesson.curriculumSubjectId,
      );

      const already = await this.client.lessonInstance.findFirst({
        where: {
          tenantId,
          lessonId: dto.lessonId,
          subjectOfferingId: dto.subjectOfferingId,
        },
        select: { id: true },
      });
      if (already) {
        throw new BadRequestException(
          'This class already has that lesson scheduled.',
        );
      }

      const instance = await this.client.lessonInstance.create({
        data: {
          tenantId,
          lessonId: dto.lessonId,
          subjectOfferingId: dto.subjectOfferingId,
          titleOverride: dto.titleOverride?.trim() || null,
          notes: dto.notes?.trim() || null,
          scheduledFor: dto.scheduledFor ? new Date(dto.scheduledFor) : null,
          order: dto.order ?? 0,
          createdBy: actor.userId,
        },
      });
      await this.writeAudit(
        tenantId,
        actor.userId,
        'learning.lesson_instance.create',
        'lesson_instance',
        instance.id,
        `scheduled "${lesson.title}" for ${offering.subjectLabel}`,
      );
      return instance;
    });
  }

  async updateInstance(
    tenantId: string,
    actor: AcademicsActor,
    id: string,
    dto: UpdateLessonInstanceDto,
  ) {
    return this.scoped(tenantId, actor.userId, async () => {
      const existing = await this.client.lessonInstance.findFirst({
        where: { id, tenantId },
        select: {
          id: true,
          lesson: { select: { curriculumSubjectId: true, title: true } },
        },
      });
      if (!existing) throw new NotFoundException('Lesson instance not found');
      const subjectId = existing.lesson?.curriculumSubjectId;
      if (subjectId) {
        await this.access.assertCanManageCurriculumSubject(
          tenantId,
          actor,
          subjectId,
        );
      } else if (!actor.canManageAll) {
        throw new ForbiddenException(
          'You cannot change this scheduled lesson.',
        );
      }
      if (dto.status && !INSTANCE_STATUSES.includes(dto.status)) {
        throw new BadRequestException(
          `status must be one of: ${INSTANCE_STATUSES.join(', ')}`,
        );
      }

      const instance = await this.client.lessonInstance.update({
        where: { id },
        data: {
          titleOverride:
            dto.titleOverride === undefined
              ? undefined
              : dto.titleOverride?.trim() || null,
          notes:
            dto.notes === undefined ? undefined : dto.notes?.trim() || null,
          scheduledFor:
            dto.scheduledFor === undefined
              ? undefined
              : dto.scheduledFor
                ? new Date(dto.scheduledFor)
                : null,
          // Marking it taught stamps the time, so "when did this arm cover it?"
          // is answerable without a separate event log.
          taughtAt:
            dto.status === 'taught'
              ? new Date()
              : dto.status === 'planned'
                ? null
                : undefined,
          status: dto.status,
          order: dto.order,
          updatedBy: actor.userId,
        },
      });
      await this.writeAudit(
        tenantId,
        actor.userId,
        'learning.lesson_instance.update',
        'lesson_instance',
        id,
        `updated scheduled lesson "${existing.lesson?.title ?? id}"`,
      );
      return instance;
    });
  }

  async deleteInstance(tenantId: string, actor: AcademicsActor, id: string) {
    return this.scoped(tenantId, actor.userId, async () => {
      const existing = await this.client.lessonInstance.findFirst({
        where: { id, tenantId },
        select: {
          id: true,
          lesson: { select: { curriculumSubjectId: true, title: true } },
        },
      });
      if (!existing) throw new NotFoundException('Lesson instance not found');
      const subjectId = existing.lesson?.curriculumSubjectId;
      if (subjectId) {
        await this.access.assertCanManageCurriculumSubject(
          tenantId,
          actor,
          subjectId,
        );
      } else if (!actor.canManageAll) {
        throw new ForbiddenException(
          'You cannot remove this scheduled lesson.',
        );
      }
      // Removing the instance never touches the library lesson — un-scheduling
      // a lesson for one arm must not delete the content everyone else uses.
      await this.client.lessonInstance.delete({ where: { id } });
      await this.writeAudit(
        tenantId,
        actor.userId,
        'learning.lesson_instance.delete',
        'lesson_instance',
        id,
        `unscheduled "${existing.lesson?.title ?? id}"`,
      );
      return { deleted: true };
    });
  }
}
