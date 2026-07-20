/**
 * Learning substrate isolation proof (ai-integration-plan Step 4).
 *
 * The Academic AI tutor's core privacy promise: similarity search over one
 * lesson NEVER returns another tenant's or another lesson's chunks. This
 * spec plants chunks with IDENTICAL embeddings in (a) the target lesson,
 * (b) a sibling lesson of the same tenant, and (c) a lesson of another
 * tenant — a leak in either scope dimension would rank those equally-similar
 * decoys at the top. It also proves the ingestion pipeline end-to-end
 * (storage → extraction → chunking → embedding → rows) with a
 * deterministic stub EmbeddingsProvider (no network).
 *
 * Requires APP_RUNTIME_DATABASE_URL (real Postgres with the learning
 * migration applied); skips otherwise.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

const HAS_DB = !!process.env.APP_RUNTIME_DATABASE_URL;
const d = HAS_DB ? describe : describe.skip;

// Must be set before the app (and LocalDiskStorageService) is constructed.
const storageRoot = mkdtempSync(path.join(tmpdir(), 'swe-learning-e2e-'));
process.env.STORAGE_LOCAL_ROOT = storageRoot;

import { AppModule } from '../src/app.module';
import { DatabaseService, TenantDbService } from '../src/common';
import {
  EMBEDDINGS_PROVIDER,
  type EmbeddingsProvider,
} from '../src/ai/embeddings/embeddings.types';
import { LearningRetrievalService } from '../src/learning/services/learning-retrieval.service';
import { LearningService } from '../src/learning/services/learning.service';

const DIMS = 1024;

function basisVector(index: number): number[] {
  const v = new Array(DIMS).fill(0);
  v[index % DIMS] = 1;
  return v;
}

/** Deterministic, network-free stand-in for Voyage. */
const stubEmbeddings: EmbeddingsProvider = {
  providerName: 'stub',
  isAvailable: true,
  dimensions: DIMS,
  embed: async (texts) => texts.map((t) => basisVector(t.length)),
};

d('Learning substrate isolation (Step 4 acceptance)', () => {
  let app: INestApplication;
  let owner: DatabaseService['client'];
  let tenantDb: TenantDbService;
  let retrieval: LearningRetrievalService;
  let learning: LearningService;

  const slugA = `learniso-a-${Date.now()}`;
  const slugB = `learniso-b-${Date.now()}`;
  let tenantAId: string;
  let tenantBId: string;
  let lessonA1Id: string;
  let lessonA2Id: string;
  let lessonB1Id: string;

  async function seedLesson(
    tenantId: string,
    suffix: string,
  ): Promise<string> {
    const year = await owner.academicYear.create({
      data: {
        tenantId,
        name: `2026-${suffix}`,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
      },
    });
    const term = await owner.term.create({
      data: {
        academicYearId: year.id,
        tenantId,
        name: `Term ${suffix}`,
        type: 'term',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-04-30'),
        order: 1,
      },
    });
    const course = await owner.course.create({
      data: { tenantId, code: `BIO-${suffix}`, name: `Biology ${suffix}` },
    });
    const klass = await owner.class.create({
      data: {
        courseId: course.id,
        termId: term.id,
        academicYearId: year.id,
        tenantId,
        section: 'A',
      },
    });
    const lesson = await owner.lesson.create({
      data: { tenantId, classId: klass.id, title: `Lesson ${suffix}` },
    });
    return lesson.id;
  }

  async function plantChunk(
    tenantId: string,
    lessonId: string,
    content: string,
    embedding: number[],
  ): Promise<void> {
    const material = await owner.lessonMaterial.create({
      data: {
        tenantId,
        lessonId,
        title: content,
        fileName: `${content}.txt`,
        mimeType: 'text/plain',
        sizeBytes: content.length,
        storageKey: `materials/${tenantId}/${content}`,
        extractionStatus: 'completed',
        chunkCount: 1,
      },
    });
    await owner.$executeRaw`
      INSERT INTO "learning"."material_chunks"
        ("id", "tenant_id", "lesson_id", "material_id",
         "chunk_index", "content", "embedding")
      VALUES
        (gen_random_uuid(), ${tenantId}, ${lessonId}, ${material.id},
         0, ${content}, ${`[${embedding.join(',')}]`}::vector)
    `;
  }

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(EMBEDDINGS_PROVIDER)
      .useValue(stubEmbeddings)
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();

    owner = app.get(DatabaseService).client;
    tenantDb = app.get(TenantDbService);
    retrieval = app.get(LearningRetrievalService);
    learning = app.get(LearningService);

    const ta = await owner.tenant.create({
      data: { name: 'Learn Iso A', slug: slugA, status: 'active' },
    });
    const tb = await owner.tenant.create({
      data: { name: 'Learn Iso B', slug: slugB, status: 'active' },
    });
    tenantAId = ta.id;
    tenantBId = tb.id;

    lessonA1Id = await seedLesson(tenantAId, 'a1');
    lessonA2Id = await seedLesson(tenantAId, 'a2');
    lessonB1Id = await seedLesson(tenantBId, 'b1');

    // The decoys carry the SAME embedding as the target chunk — if either
    // scope predicate (or RLS) leaked, they would tie at the top.
    const match = basisVector(0);
    await plantChunk(tenantAId, lessonA1Id, 'TARGET-A1', match);
    await plantChunk(tenantAId, lessonA1Id, 'OFFTOPIC-A1', basisVector(7));
    await plantChunk(tenantAId, lessonA2Id, 'DECOY-SIBLING-LESSON', match);
    await plantChunk(tenantBId, lessonB1Id, 'DECOY-OTHER-TENANT', match);
  }, 60000);

  afterAll(async () => {
    if (owner) {
      await owner.tenant.deleteMany({ where: { slug: { in: [slugA, slugB] } } });
    }
    if (app) await app.close();
    rmSync(storageRoot, { recursive: true, force: true });
  });

  it('returns only the target lesson chunks, ranked by similarity', async () => {
    const results = await retrieval.searchLessonByVector(
      tenantAId,
      lessonA1Id,
      basisVector(0),
      10,
    );

    expect(results.map((r) => r.content)).toEqual([
      'TARGET-A1',
      'OFFTOPIC-A1',
    ]);
    expect(results[0].similarity).toBeCloseTo(1, 5);
    expect(results[0].similarity).toBeGreaterThan(results[1].similarity);
  });

  it('never returns another lesson\'s chunks (same tenant)', async () => {
    const results = await retrieval.searchLessonByVector(
      tenantAId,
      lessonA2Id,
      basisVector(0),
      10,
    );
    expect(results.map((r) => r.content)).toEqual(['DECOY-SIBLING-LESSON']);
  });

  it('never returns another tenant\'s chunks, even for its own lesson id', async () => {
    // Tenant B asking with tenant A's lesson id must get nothing at all.
    const crossTenant = await retrieval.searchLessonByVector(
      tenantBId,
      lessonA1Id,
      basisVector(0),
      10,
    );
    expect(crossTenant).toEqual([]);

    // And tenant B's own lesson search stays inside tenant B.
    const own = await retrieval.searchLessonByVector(
      tenantBId,
      lessonB1Id,
      basisVector(0),
      10,
    );
    expect(own.map((r) => r.content)).toEqual(['DECOY-OTHER-TENANT']);
  });

  it('RLS backstop: chunks are invisible under another tenant\'s scope', async () => {
    const rows = await tenantDb.runScoped(tenantBId, undefined, () =>
      tenantDb.client.materialChunk.findMany({
        where: { content: { startsWith: 'TARGET-' } },
      }),
    );
    expect(rows).toEqual([]);
  });

  it('ingests an uploaded TXT end-to-end: chunks + embeddings, tenant-scoped', async () => {
    const content = [
      'Photosynthesis is the process by which plants convert light energy into chemical energy.',
      'The Calvin cycle then fixes carbon dioxide into sugars inside the stroma of the chloroplast.',
    ].join('\n\n');

    const material = await learning.uploadMaterial(
      tenantAId,
      lessonA1Id,
      {
        originalname: 'photosynthesis.txt',
        mimetype: 'text/plain',
        size: Buffer.byteLength(content),
        buffer: Buffer.from(content, 'utf8'),
      },
      {},
      // Admin-shaped actor: the ownership rules (ClassTeacher) are covered
      // by unit tests; this spec is about ingestion + isolation.
      {
        userId: 'e2e-user',
        profileId: 'e2e-profile',
        canViewAll: true,
        canManageAll: true,
      },
    );
    expect(material.extractionStatus).toBe('pending');

    // uploadMaterial fired the detached ingestion job; poll it to completion.
    let updated = await owner.lessonMaterial.findUnique({
      where: { id: material.id },
    });
    const deadline = Date.now() + 15000;
    while (
      updated?.extractionStatus !== 'completed' &&
      updated?.extractionStatus !== 'failed' &&
      Date.now() < deadline
    ) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      updated = await owner.lessonMaterial.findUnique({
        where: { id: material.id },
      });
    }
    expect(updated?.extractionError).toBeNull();
    expect(updated?.extractionStatus).toBe('completed');
    expect(updated?.chunkCount).toBeGreaterThan(0);

    const embedded = await owner.$queryRaw<
      Array<{ count: bigint }>
    >`
      SELECT COUNT(*)::bigint AS count
      FROM "learning"."material_chunks"
      WHERE "material_id" = ${material.id}
        AND "tenant_id" = ${tenantAId}
        AND "lesson_id" = ${lessonA1Id}
        AND "embedding" IS NOT NULL
    `;
    expect(Number(embedded[0].count)).toBe(updated?.chunkCount);
  }, 30000);
});
