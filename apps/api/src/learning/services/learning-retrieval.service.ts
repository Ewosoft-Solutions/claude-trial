import { Inject, Injectable } from '@nestjs/common';
import { TenantDbService } from '../../common/database/tenant-db.service';
import {
  EMBEDDINGS_PROVIDER,
  type EmbeddingsProvider,
} from '../../ai/embeddings/embeddings.types';
import { toVectorLiteral } from './material-ingestion.service';

export interface RetrievedChunk {
  id: string;
  materialId: string;
  chunkIndex: number;
  content: string;
  similarity: number;
}

/**
 * Similarity search over material_chunks, ALWAYS scoped to
 * (tenantId, lessonId) — the tutor's core privacy boundary. Two layers
 * enforce it: the explicit SQL predicates here, and Postgres RLS because
 * the query runs on the runScoped transaction connection. The query
 * embedding round-trip happens before the transaction opens (same
 * discipline as the chat tool loop).
 */
@Injectable()
export class LearningRetrievalService {
  constructor(
    private readonly tenantDb: TenantDbService,
    @Inject(EMBEDDINGS_PROVIDER) private readonly embeddings: EmbeddingsProvider,
  ) {}

  async searchLesson(
    tenantId: string,
    lessonId: string,
    query: string,
    topK = 5,
    userId?: string,
  ): Promise<RetrievedChunk[]> {
    const [queryVector] = await this.embeddings.embed([query], 'query');
    return this.searchLessonByVector(tenantId, lessonId, queryVector, topK, userId);
  }

  /** Vector-level entry point (isolation tests inject vectors directly). */
  async searchLessonByVector(
    tenantId: string,
    lessonId: string,
    queryVector: number[],
    topK = 5,
    userId?: string,
  ): Promise<RetrievedChunk[]> {
    const literal = toVectorLiteral(queryVector);
    const rows = await this.tenantDb.runScoped(tenantId, userId, () =>
      this.tenantDb.client.$queryRaw<
        Array<{
          id: string;
          material_id: string;
          chunk_index: number;
          content: string;
          similarity: number;
        }>
      >`
        SELECT
          "id",
          "material_id",
          "chunk_index",
          "content",
          1 - ("embedding" <=> ${literal}::vector) AS "similarity"
        FROM "learning"."material_chunks"
        WHERE "tenant_id" = ${tenantId}
          AND "lesson_id" = ${lessonId}
          AND "embedding" IS NOT NULL
        ORDER BY "embedding" <=> ${literal}::vector
        LIMIT ${topK}
      `,
    );

    return rows.map((row) => ({
      id: row.id,
      materialId: row.material_id,
      chunkIndex: row.chunk_index,
      content: row.content,
      similarity: Number(row.similarity),
    }));
  }
}
