import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TenantDbService } from '../../common/database/tenant-db.service';
import {
  AcademicsAccessService,
  type AcademicsActor,
} from '../../common/academics/academics-access.service';
import {
  STORAGE_PROVIDER,
  type StorageProvider,
  type StorageObject,
} from '../../common/storage/storage.types';
import {
  CATEGORY_MAX_BYTES,
  resolveMaterial,
  UnsupportedMaterialError,
} from './material-extraction.service';
import { MaterialIngestionService } from './material-ingestion.service';
import {
  CreateLessonDto,
  ListLessonsDto,
  ReviewDecisionDto,
  UpdateLessonDto,
  UploadMaterialDto,
} from '../dto/learning.dto';

export interface UploadedFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

const MATERIAL_SELECT = {
  id: true,
  lessonId: true,
  title: true,
  fileName: true,
  mimeType: true,
  sizeBytes: true,
  category: true,
  reviewStatus: true,
  reviewedBy: true,
  reviewedAt: true,
  reviewNote: true,
  extractionStatus: true,
  extractionError: true,
  chunkCount: true,
  createdAt: true,
  updatedAt: true,
} as const;

const LESSON_CLASS_SELECT = {
  id: true,
  section: true,
  name: true,
  course: { select: { id: true, code: true, name: true } },
} as const;

/** What a student is allowed to see: published lessons whose review passed. */
const STUDENT_LESSON_WHERE = {
  status: 'published',
  reviewStatus: 'approved',
} as const;

/**
 * Lessons + materials CRUD with the academics access rules:
 *  - teachers author only for classes they're allocated to (ClassTeacher),
 *    admins override via `lessons.manage.all`;
 *  - students (`lessons.view.own` without `lessons.view`) see only
 *    published + approved lessons of classes they're actively enrolled in,
 *    and only approved materials;
 *  - content edits invalidate a previous approval (back to 'draft').
 *
 * Not behind @TenantScoped (AI-module precedent: ingestion runs detached
 * and must never hold an RLS transaction across an embeddings round-trip)
 * — every DB unit of work runs in its own tenantDb.runScoped block.
 */
@Injectable()
export class LearningService {
  constructor(
    private readonly tenantDb: TenantDbService,
    private readonly ingestion: MaterialIngestionService,
    private readonly access: AcademicsAccessService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  private scoped<T>(
    tenantId: string,
    userId: string | undefined,
    fn: () => Promise<T>,
  ): Promise<T> {
    return this.tenantDb.runScoped(tenantId, userId, fn);
  }

  /**
   * Extra `where` filters for lesson reads by a restricted (student)
   * actor. Full viewers get no extra filter.
   */
  private async studentLessonFilter(tenantId: string, actor: AcademicsActor) {
    const classIds = await this.access.getEnrolledClassIds(
      tenantId,
      actor.profileId,
    );
    return { ...STUDENT_LESSON_WHERE, classId: { in: classIds } };
  }

  private async lessonReadFilter(tenantId: string, actor: AcademicsActor) {
    if (actor.canManageAll) return {};
    if (actor.canViewAll) {
      const classIds = await this.access.getTaughtClassIds(
        tenantId,
        actor.profileId,
      );
      return { classId: { in: classIds } };
    }
    return this.studentLessonFilter(tenantId, actor);
  }

  // ---- Lessons ------------------------------------------------------

  async listLessons(
    tenantId: string,
    query: ListLessonsDto,
    actor: AcademicsActor,
  ) {
    return this.scoped(tenantId, actor.userId, async () => {
      const restricted = await this.lessonReadFilter(tenantId, actor);
      return this.tenantDb.client.lesson.findMany({
        where: {
          tenantId,
          ...(query.classId ? { classId: query.classId } : {}),
          ...(query.status ? { status: query.status } : {}),
          ...(query.reviewStatus ? { reviewStatus: query.reviewStatus } : {}),
          ...restricted,
        },
        include: {
          class: { select: LESSON_CLASS_SELECT },
          _count: { select: { materials: true } },
        },
        orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      });
    });
  }

  async getLesson(tenantId: string, id: string, actor: AcademicsActor) {
    const lesson = await this.scoped(tenantId, actor.userId, async () => {
      const restricted = await this.lessonReadFilter(tenantId, actor);
      return this.tenantDb.client.lesson.findFirst({
        where: { id, tenantId, ...restricted },
        include: {
          class: { select: LESSON_CLASS_SELECT },
          materials: {
            select: MATERIAL_SELECT,
            // Students never see unapproved uploads.
            ...(actor.canViewAll
              ? {}
              : { where: { reviewStatus: 'approved' } }),
            orderBy: { createdAt: 'asc' },
          },
        },
      });
    });
    if (!lesson) throw new NotFoundException('Lesson not found');
    return lesson;
  }

  async createLesson(
    tenantId: string,
    dto: CreateLessonDto,
    actor: AcademicsActor,
  ) {
    return this.scoped(tenantId, actor.userId, async () => {
      const klass = await this.tenantDb.client.class.findFirst({
        where: { id: dto.classId, tenantId },
        select: { id: true },
      });
      if (!klass) throw new BadRequestException('Class not found');

      await this.access.assertCanManageClass(tenantId, actor, dto.classId);

      if (dto.status === 'published') {
        throw new BadRequestException(
          'Lessons must be approved before publishing',
        );
      }

      return this.tenantDb.client.lesson.create({
        data: {
          tenantId,
          classId: dto.classId,
          title: dto.title,
          description: dto.description ?? null,
          content: dto.content ?? null,
          order: dto.order ?? 0,
          status: dto.status ?? 'draft',
          createdBy: actor.userId,
          updatedBy: actor.userId,
        },
      });
    });
  }

  async updateLesson(
    tenantId: string,
    id: string,
    dto: UpdateLessonDto,
    actor: AcademicsActor,
  ) {
    return this.scoped(tenantId, actor.userId, async () => {
      const lesson = await this.tenantDb.client.lesson.findFirst({
        where: { id, tenantId },
        select: { id: true, classId: true, status: true, reviewStatus: true },
      });
      if (!lesson) throw new NotFoundException('Lesson not found');

      await this.access.assertCanManageClass(tenantId, actor, lesson.classId);

      // Substantive edits invalidate a previous approval — the content on
      // display must be the content that was reviewed.
      const editsContent =
        dto.title !== undefined ||
        dto.description !== undefined ||
        dto.content !== undefined;
      const reviewReset =
        editsContent && lesson.reviewStatus !== 'draft'
          ? {
              reviewStatus: 'draft',
              submittedForReviewAt: null,
              reviewedBy: null,
              reviewedAt: null,
              reviewNote: null,
            }
          : {};

      if (dto.status === 'published') {
        const effectiveReview =
          'reviewStatus' in reviewReset
            ? reviewReset.reviewStatus
            : lesson.reviewStatus;
        if (effectiveReview !== 'approved') {
          throw new BadRequestException(
            'Lessons must be approved before publishing',
          );
        }
      }

      // Un-publishing on content edits: a published lesson whose approval
      // was just reset drops back to draft visibility.
      const statusReset =
        'reviewStatus' in reviewReset &&
        lesson.status === 'published' &&
        dto.status === undefined
          ? { status: 'draft' }
          : {};

      return this.tenantDb.client.lesson.update({
        where: { id },
        data: {
          ...(dto.title !== undefined ? { title: dto.title } : {}),
          ...(dto.description !== undefined
            ? { description: dto.description }
            : {}),
          ...(dto.content !== undefined ? { content: dto.content } : {}),
          ...(dto.order !== undefined ? { order: dto.order } : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
          ...reviewReset,
          ...statusReset,
          updatedBy: actor.userId,
        },
      });
    });
  }

  async deleteLesson(tenantId: string, id: string, actor: AcademicsActor) {
    const materials = await this.scoped(tenantId, actor.userId, async () => {
      const lesson = await this.tenantDb.client.lesson.findFirst({
        where: { id, tenantId },
        select: {
          id: true,
          classId: true,
          materials: { select: { storageKey: true } },
        },
      });
      if (!lesson) throw new NotFoundException('Lesson not found');
      await this.access.assertCanManageClass(tenantId, actor, lesson.classId);
      await this.tenantDb.client.lesson.delete({ where: { id } });
      return lesson.materials;
    });

    // Binaries are cleaned up best-effort after the rows are gone.
    for (const material of materials) {
      await this.storage.delete(material.storageKey).catch(() => undefined);
    }
    return { deleted: true };
  }

  // ---- Lesson review workflow ----------------------------------------

  async submitLessonForReview(
    tenantId: string,
    id: string,
    actor: AcademicsActor,
  ) {
    return this.scoped(tenantId, actor.userId, async () => {
      const lesson = await this.tenantDb.client.lesson.findFirst({
        where: { id, tenantId },
        select: { id: true, classId: true, reviewStatus: true },
      });
      if (!lesson) throw new NotFoundException('Lesson not found');
      await this.access.assertCanManageClass(tenantId, actor, lesson.classId);

      if (lesson.reviewStatus === 'pending_review') {
        throw new BadRequestException('Lesson is already awaiting review');
      }
      if (lesson.reviewStatus === 'approved') {
        throw new BadRequestException('Lesson is already approved');
      }

      return this.tenantDb.client.lesson.update({
        where: { id },
        data: {
          reviewStatus: 'pending_review',
          submittedForReviewAt: new Date(),
          reviewedBy: null,
          reviewedAt: null,
          reviewNote: null,
          updatedBy: actor.userId,
        },
      });
    });
  }

  async reviewLesson(
    tenantId: string,
    id: string,
    decision: 'approved' | 'rejected',
    dto: ReviewDecisionDto,
    actor: AcademicsActor,
  ) {
    if (decision === 'rejected' && !dto.note?.trim()) {
      throw new BadRequestException('A note is required when rejecting');
    }
    return this.scoped(tenantId, actor.userId, async () => {
      const lesson = await this.tenantDb.client.lesson.findFirst({
        where: { id, tenantId },
        select: { id: true, reviewStatus: true },
      });
      if (!lesson) throw new NotFoundException('Lesson not found');
      if (lesson.reviewStatus !== 'pending_review') {
        throw new BadRequestException(
          'Only lessons awaiting review can be approved or rejected',
        );
      }

      return this.tenantDb.client.lesson.update({
        where: { id },
        data: {
          reviewStatus: decision,
          reviewedBy: actor.profileId,
          reviewedAt: new Date(),
          reviewNote: dto.note?.trim() || null,
          updatedBy: actor.userId,
        },
      });
    });
  }

  // ---- Materials ----------------------------------------------------

  async listMaterials(
    tenantId: string,
    lessonId: string,
    actor: AcademicsActor,
  ) {
    return this.scoped(tenantId, actor.userId, async () => {
      const restricted = await this.lessonReadFilter(tenantId, actor);
      const lesson = await this.tenantDb.client.lesson.findFirst({
        where: { id: lessonId, tenantId, ...restricted },
        select: { id: true },
      });
      if (!lesson) throw new NotFoundException('Lesson not found');

      return this.tenantDb.client.lessonMaterial.findMany({
        where: {
          lessonId,
          tenantId,
          ...(actor.canViewAll ? {} : { reviewStatus: 'approved' }),
        },
        select: MATERIAL_SELECT,
        orderBy: { createdAt: 'asc' },
      });
    });
  }

  async uploadMaterial(
    tenantId: string,
    lessonId: string,
    file: UploadedFile,
    dto: UploadMaterialDto,
    actor: AcademicsActor,
  ) {
    const resolved = resolveMaterial(file.mimetype, file.originalname);
    if (!resolved) {
      const error = new UnsupportedMaterialError(
        file.mimetype,
        file.originalname,
      );
      throw new BadRequestException(error.message);
    }

    const maxBytes = CATEGORY_MAX_BYTES[resolved.category];
    if (file.size > maxBytes) {
      throw new BadRequestException(
        `${resolved.category} uploads are limited to ${Math.floor(maxBytes / (1024 * 1024))} MB`,
      );
    }

    const materialId = randomUUID();
    const safeName = file.originalname.replace(/[^\w.-]+/g, '_').slice(-120);
    const storageKey = `materials/${tenantId}/${materialId}/${safeName}`;

    await this.storage.put(storageKey, file.buffer, file.mimetype);

    const material = await this.scoped(tenantId, actor.userId, async () => {
      const lesson = await this.tenantDb.client.lesson.findFirst({
        where: { id: lessonId, tenantId },
        select: { id: true, classId: true },
      });
      if (!lesson) throw new NotFoundException('Lesson not found');
      await this.access.assertCanManageClass(tenantId, actor, lesson.classId);

      return this.tenantDb.client.lessonMaterial.create({
        data: {
          id: materialId,
          tenantId,
          lessonId,
          title: dto.title?.trim() || file.originalname,
          fileName: file.originalname,
          mimeType: file.mimetype,
          sizeBytes: file.size,
          storageKey,
          category: resolved.category,
          reviewStatus: 'pending_review',
          // Media has no text to extract; mark it skipped so the pipeline
          // status stays truthful.
          extractionStatus: resolved.kind ? 'pending' : 'skipped',
          createdBy: actor.userId,
          updatedBy: actor.userId,
        },
        select: MATERIAL_SELECT,
      });
    }).catch(async (error: unknown) => {
      await this.storage.delete(storageKey).catch(() => undefined);
      throw error;
    });

    if (resolved.kind) {
      this.ingestion.enqueue({
        materialId,
        tenantId,
        lessonId,
        storageKey,
        kind: resolved.kind,
        userId: actor.userId,
      });
    }

    return material;
  }

  async downloadMaterial(
    tenantId: string,
    id: string,
    actor: AcademicsActor,
  ): Promise<{
    object: StorageObject;
    fileName: string;
    mimeType: string;
  }> {
    const material = await this.scoped(tenantId, actor.userId, async () => {
      const restricted = actor.canManageAll
        ? {}
        : {
            ...(actor.canViewAll ? {} : { reviewStatus: 'approved' }),
            lesson: await this.lessonReadFilter(tenantId, actor),
          };
      return this.tenantDb.client.lessonMaterial.findFirst({
        where: { id, tenantId, ...restricted },
        select: { storageKey: true, fileName: true, mimeType: true },
      });
    });
    if (!material) throw new NotFoundException('Material not found');

    const object = await this.storage.get(material.storageKey);
    return {
      object,
      fileName: material.fileName,
      mimeType: material.mimeType,
    };
  }

  async reviewMaterial(
    tenantId: string,
    id: string,
    decision: 'approved' | 'rejected',
    dto: ReviewDecisionDto,
    actor: AcademicsActor,
  ) {
    if (decision === 'rejected' && !dto.note?.trim()) {
      throw new BadRequestException('A note is required when rejecting');
    }
    return this.scoped(tenantId, actor.userId, async () => {
      const material = await this.tenantDb.client.lessonMaterial.findFirst({
        where: { id, tenantId },
        select: { id: true, reviewStatus: true },
      });
      if (!material) throw new NotFoundException('Material not found');
      if (material.reviewStatus === decision) {
        throw new BadRequestException(`Material is already ${decision}`);
      }

      return this.tenantDb.client.lessonMaterial.update({
        where: { id },
        data: {
          reviewStatus: decision,
          reviewedBy: actor.profileId,
          reviewedAt: new Date(),
          reviewNote: dto.note?.trim() || null,
          updatedBy: actor.userId,
        },
        select: MATERIAL_SELECT,
      });
    });
  }

  async reprocessMaterial(tenantId: string, id: string, actor: AcademicsActor) {
    const material = await this.scoped(tenantId, actor.userId, async () => {
      const found = await this.tenantDb.client.lessonMaterial.findFirst({
        where: { id, tenantId },
        select: {
          id: true,
          lessonId: true,
          storageKey: true,
          mimeType: true,
          fileName: true,
          extractionStatus: true,
          lesson: { select: { classId: true } },
        },
      });
      if (!found) throw new NotFoundException('Material not found');
      await this.access.assertCanManageClass(
        tenantId,
        actor,
        found.lesson.classId,
      );
      return found;
    });
    if (material.extractionStatus === 'processing') {
      throw new BadRequestException('Material is already being processed');
    }

    const resolved = resolveMaterial(material.mimeType, material.fileName);
    if (!resolved?.kind) {
      throw new BadRequestException(
        'Only document materials can be reprocessed',
      );
    }

    this.ingestion.enqueue({
      materialId: material.id,
      tenantId,
      lessonId: material.lessonId,
      storageKey: material.storageKey,
      kind: resolved.kind,
      userId: actor.userId,
    });

    return { queued: true };
  }

  async deleteMaterial(tenantId: string, id: string, actor: AcademicsActor) {
    const material = await this.scoped(tenantId, actor.userId, async () => {
      const found = await this.tenantDb.client.lessonMaterial.findFirst({
        where: { id, tenantId },
        select: {
          id: true,
          storageKey: true,
          lesson: { select: { classId: true } },
        },
      });
      if (!found) throw new NotFoundException('Material not found');
      await this.access.assertCanManageClass(
        tenantId,
        actor,
        found.lesson.classId,
      );
      await this.tenantDb.client.lessonMaterial.delete({ where: { id } });
      return found;
    });

    await this.storage.delete(material.storageKey).catch(() => undefined);
    return { deleted: true };
  }
}
