import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { TenantDbService } from '../../common/database/tenant-db.service';
import { QueueService } from '../../common/queue/queue.service';
import {
  STORAGE_PROVIDER,
  type StorageProvider,
} from '../../common/storage/storage.types';
import {
  EMBEDDINGS_PROVIDER,
  type EmbeddingsProvider,
} from '../../ai/embeddings/embeddings.types';
import {
  MaterialExtractionService,
  type MaterialKind,
} from './material-extraction.service';
import { chunkText } from './chunking';

interface IngestTarget {
  materialId: string;
  tenantId: string;
  lessonId: string;
  storageKey: string;
  kind: MaterialKind;
  userId?: string;
}

/**
 * Upload → text → chunks → embeddings → material_chunks rows.
 *
 * Runs detached from the upload request (fire-and-forget; QueueService
 * tracks job status). The RLS discipline from the chat loop applies to
 * embedding jobs too: extraction and the embeddings HTTP round-trip happen
 * OUTSIDE any tenant transaction; only the short row writes run inside
 * `runScoped` (15s cap). Chunk inserts are raw SQL because the embedding
 * column is Unsupported("vector") to prisma-client-js.
 */
@Injectable()
export class MaterialIngestionService {
  private readonly logger = new Logger(MaterialIngestionService.name);

  constructor(
    private readonly tenantDb: TenantDbService,
    private readonly queue: QueueService,
    private readonly extraction: MaterialExtractionService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
    @Inject(EMBEDDINGS_PROVIDER) private readonly embeddings: EmbeddingsProvider,
  ) {}

  /** Kick off ingestion without blocking the caller. */
  enqueue(target: IngestTarget): void {
    const job = this.queue.enqueue(
      'lesson-material-ingestion',
      { materialId: target.materialId },
      target.tenantId,
    );
    void this.ingest(target)
      .then(() => this.queue.markCompleted(job.id))
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        this.queue.markFailed(job.id, message);
        this.logger.error(
          `Ingestion failed for material ${target.materialId}: ${message}`,
        );
      });
  }

  /** Full pipeline; also used directly (awaited) by tests. */
  async ingest(target: IngestTarget): Promise<void> {
    const { materialId, tenantId, lessonId, userId } = target;

    await this.setStatus(target, 'processing', null);

    try {
      const object = await this.storage.get(target.storageKey);
      const text = await this.extraction.extractText(object.data, target.kind);
      const chunks = chunkText(text);
      if (chunks.length === 0) {
        throw new Error(
          'No extractable text found in this file (image-only PDFs are not supported yet)',
        );
      }

      const vectors = await this.embeddings.embed(
        chunks.map((chunk) => chunk.content),
        'document',
      );

      await this.tenantDb.runScoped(tenantId, userId, async () => {
        const tx = this.tenantDb.client;
        await tx.materialChunk.deleteMany({ where: { materialId, tenantId } });
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          const metadata = JSON.stringify({
            start: chunk.start,
            end: chunk.end,
            embeddingModel: this.embeddings.providerName,
          });
          await tx.$executeRaw`
            INSERT INTO "learning"."material_chunks"
              ("id", "tenant_id", "lesson_id", "material_id",
               "chunk_index", "content", "embedding", "metadata")
            VALUES
              (${randomUUID()}, ${tenantId}, ${lessonId}, ${materialId},
               ${chunk.index}, ${chunk.content},
               ${toVectorLiteral(vectors[i])}::vector, ${metadata}::jsonb)
          `;
        }
        await tx.lessonMaterial.update({
          where: { id: materialId },
          data: {
            extractionStatus: 'completed',
            extractionError: null,
            chunkCount: chunks.length,
            updatedBy: userId ?? null,
          },
        });
      });

      this.logger.log(
        `Ingested material ${materialId}: ${chunks.length} chunks embedded`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.setStatus(target, 'failed', message.slice(0, 500));
      throw error;
    }
  }

  private async setStatus(
    target: IngestTarget,
    status: 'processing' | 'failed',
    error: string | null,
  ): Promise<void> {
    await this.tenantDb.runScoped(target.tenantId, target.userId, () =>
      this.tenantDb.client.lessonMaterial.update({
        where: { id: target.materialId },
        data: { extractionStatus: status, extractionError: error },
      }),
    );
  }
}

/** pgvector input literal: '[0.1,0.2,...]'. */
export function toVectorLiteral(vector: number[]): string {
  return `[${vector.join(',')}]`;
}
