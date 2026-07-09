/**
 * LearningService unit tests — the approval-gate contract
 * (docs/academics-reuse-assessment.md §2.2): student reads are pinned to
 * published + approved content of enrolled classes, publishing requires a
 * passed review, content edits invalidate approvals, and media uploads
 * skip the extraction pipeline.
 */
import { BadRequestException } from '@nestjs/common';
import { LearningService } from './learning.service';

const TENANT = 'tenant-1';
const TEACHER = {
  userId: 'user-1',
  profileId: 'profile-1',
  canViewAll: true,
  canManageAll: false,
};
const STUDENT = {
  userId: 'user-2',
  profileId: 'profile-2',
  canViewAll: false,
  canManageAll: false,
};

function makeService(overrides?: {
  lesson?: Record<string, unknown> | null;
  material?: Record<string, unknown> | null;
}) {
  const lessonUpdates: Array<{ data: Record<string, unknown> }> = [];
  const materialCreates: Array<{ data: Record<string, unknown> }> = [];
  const findManyCalls: Array<Record<string, unknown>> = [];

  const client = {
    lesson: {
      findFirst: jest.fn().mockResolvedValue(
        overrides?.lesson === undefined
          ? {
              id: 'lesson-1',
              classId: 'class-1',
              status: 'draft',
              reviewStatus: 'draft',
            }
          : overrides.lesson,
      ),
      findMany: jest
        .fn()
        .mockImplementation((args: Record<string, unknown>) => {
          findManyCalls.push(args);
          return Promise.resolve([]);
        }),
      create: jest
        .fn()
        .mockImplementation(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({ id: 'lesson-1', ...data }),
        ),
      update: jest
        .fn()
        .mockImplementation((args: { data: Record<string, unknown> }) => {
          lessonUpdates.push(args);
          return Promise.resolve({ id: 'lesson-1', ...args.data });
        }),
    },
    lessonMaterial: {
      findFirst: jest.fn().mockResolvedValue(overrides?.material ?? null),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest
        .fn()
        .mockImplementation((args: { data: Record<string, unknown> }) => {
          materialCreates.push(args);
          return Promise.resolve({ id: args.data.id, ...args.data });
        }),
      update: jest
        .fn()
        .mockImplementation(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({ id: 'material-1', ...data }),
        ),
    },
    class: {
      findFirst: jest.fn().mockResolvedValue({ id: 'class-1' }),
    },
  };

  const tenantDb = {
    client,
    runScoped: jest.fn().mockImplementation((_t, _u, fn) => fn()),
  };

  const ingestion = { enqueue: jest.fn() };
  const access = {
    assertCanManageClass: jest.fn().mockResolvedValue(undefined),
    getEnrolledClassIds: jest.fn().mockResolvedValue(['class-1', 'class-2']),
    getTaughtClassIds: jest.fn().mockResolvedValue(['class-3', 'class-4']),
  };
  const storage = {
    providerName: 'test',
    put: jest.fn().mockResolvedValue(undefined),
    get: jest.fn(),
    delete: jest.fn().mockResolvedValue(undefined),
  };

  const service = new LearningService(
    tenantDb as never,
    ingestion as never,
    access as never,
    storage as never,
  );

  return {
    service,
    client,
    ingestion,
    access,
    storage,
    lessonUpdates,
    materialCreates,
    findManyCalls,
  };
}

describe('LearningService student visibility', () => {
  it('pins student lesson lists to published + approved + enrolled classes', async () => {
    const { service, findManyCalls } = makeService();
    await service.listLessons(TENANT, {}, STUDENT);

    const where = findManyCalls[0].where as Record<string, unknown>;
    expect(where.status).toBe('published');
    expect(where.reviewStatus).toBe('approved');
    expect(where.classId).toEqual({ in: ['class-1', 'class-2'] });
  });

  it('students cannot widen the filter via query params', async () => {
    const { service, findManyCalls } = makeService();
    await service.listLessons(
      TENANT,
      { status: 'draft', reviewStatus: 'draft' } as never,
      STUDENT,
    );
    const where = findManyCalls[0].where as Record<string, unknown>;
    expect(where.status).toBe('published');
    expect(where.reviewStatus).toBe('approved');
  });

  it('scopes teachers to their taught classes without the published/approved student filter', async () => {
    const { service, findManyCalls, access } = makeService();
    await service.listLessons(TENANT, {}, TEACHER);
    const where = findManyCalls[0].where as Record<string, unknown>;
    // Teachers see drafts (no published/approved gate) but only for classes
    // they are allocated to — record-level enforcement, not the student gate.
    expect(where.status).toBeUndefined();
    expect(where.reviewStatus).toBeUndefined();
    expect(where.classId).toEqual({ in: ['class-3', 'class-4'] });
    expect(access.getTaughtClassIds).toHaveBeenCalled();
    expect(access.getEnrolledClassIds).not.toHaveBeenCalled();
  });
});

describe('LearningService review workflow', () => {
  it('refuses to create a lesson directly as published', async () => {
    const { service } = makeService();
    await expect(
      service.createLesson(
        TENANT,
        { classId: 'class-1', title: 'T', status: 'published' } as never,
        TEACHER,
      ),
    ).rejects.toThrow(/approved before publishing/);
  });

  it('refuses publishing while unapproved', async () => {
    const { service } = makeService();
    await expect(
      service.updateLesson(TENANT, 'lesson-1', { status: 'published' }, TEACHER),
    ).rejects.toThrow(/approved before publishing/);
  });

  it('resets approval (and unpublishes) when approved content is edited', async () => {
    const { service, lessonUpdates } = makeService({
      lesson: {
        id: 'lesson-1',
        classId: 'class-1',
        status: 'published',
        reviewStatus: 'approved',
      },
    });
    await service.updateLesson(TENANT, 'lesson-1', { content: 'new body' }, TEACHER);
    const data = lessonUpdates[0].data;
    expect(data.reviewStatus).toBe('draft');
    expect(data.status).toBe('draft');
    expect(data.reviewedBy).toBeNull();
  });

  it('approves only lessons that are pending review', async () => {
    const { service } = makeService(); // reviewStatus: 'draft'
    await expect(
      service.reviewLesson(TENANT, 'lesson-1', 'approved', {}, TEACHER),
    ).rejects.toThrow(/awaiting review/);
  });

  it('requires a note when rejecting', async () => {
    const { service } = makeService({
      lesson: { id: 'lesson-1', reviewStatus: 'pending_review' },
    });
    await expect(
      service.reviewLesson(TENANT, 'lesson-1', 'rejected', {}, TEACHER),
    ).rejects.toThrow(/note is required/);
  });

  it('records reviewer identity on approval', async () => {
    const { service, lessonUpdates } = makeService({
      lesson: { id: 'lesson-1', reviewStatus: 'pending_review' },
    });
    await service.reviewLesson(TENANT, 'lesson-1', 'approved', {}, TEACHER);
    expect(lessonUpdates[0].data.reviewStatus).toBe('approved');
    expect(lessonUpdates[0].data.reviewedBy).toBe(TEACHER.profileId);
  });
});

describe('LearningService material uploads', () => {
  const file = (name: string, mime: string, size = 1024) => ({
    originalname: name,
    mimetype: mime,
    size,
    buffer: Buffer.from('x'),
  });

  it('queues extraction for documents and stores them pending review', async () => {
    const { service, ingestion, materialCreates } = makeService();
    await service.uploadMaterial(
      TENANT,
      'lesson-1',
      file('notes.pdf', 'application/pdf'),
      {},
      TEACHER,
    );
    expect(materialCreates[0].data.category).toBe('document');
    expect(materialCreates[0].data.reviewStatus).toBe('pending_review');
    expect(materialCreates[0].data.extractionStatus).toBe('pending');
    expect(ingestion.enqueue).toHaveBeenCalledTimes(1);
  });

  it('stores videos without running the extraction pipeline', async () => {
    const { service, ingestion, materialCreates } = makeService();
    await service.uploadMaterial(
      TENANT,
      'lesson-1',
      file('lecture.mp4', 'video/mp4'),
      {},
      TEACHER,
    );
    expect(materialCreates[0].data.category).toBe('video');
    expect(materialCreates[0].data.extractionStatus).toBe('skipped');
    expect(ingestion.enqueue).not.toHaveBeenCalled();
  });

  it('rejects unsupported types and over-limit files', async () => {
    const { service } = makeService();
    await expect(
      service.uploadMaterial(
        TENANT,
        'lesson-1',
        file('app.exe', 'application/octet-stream'),
        {},
        TEACHER,
      ),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.uploadMaterial(
        TENANT,
        'lesson-1',
        file('big.png', 'image/png', 21 * 1024 * 1024),
        {},
        TEACHER,
      ),
    ).rejects.toThrow(/limited to/);
  });
});
