import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { JobHandlerRegistry } from '../../common/jobs/job-handler.registry';
import { JobService } from '../../common/jobs/job.service';
import type { JobContext } from '../../common/jobs/job.types';
import { STORAGE_PROVIDER } from '../../common/storage/storage.types';
import type { StorageProvider } from '../../common/storage/storage.types';
import { DOCUMENT_SCANNER } from '../storage/document-scanner';
import type { DocumentScanner } from '../storage/document-scanner';
import {
  DOCUMENT_SCAN_JOB,
  DOCUMENT_THUMBNAIL_JOB,
  DocumentScanPayload,
  DocumentThumbnailPayload,
} from './document-jobs';

/**
 * Registers the durable document-pipeline handlers on boot (F4 / ADR-08), run
 * on the F3 job substrate. Each handler runs inside the job's own tenant scope
 * (ctx.client), so its writes are RLS-correct and commit exactly-once with the
 * job completion.
 */
@Injectable()
export class DocumentJobRegistrar implements OnModuleInit {
  private readonly logger = new Logger(DocumentJobRegistrar.name);

  constructor(
    private readonly registry: JobHandlerRegistry,
    private readonly jobs: JobService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
    @Inject(DOCUMENT_SCANNER) private readonly scanner: DocumentScanner,
  ) {}

  onModuleInit(): void {
    this.registry.register<DocumentScanPayload>(DOCUMENT_SCAN_JOB, (p, ctx) =>
      this.scan(p, ctx),
    );
    this.registry.register<DocumentThumbnailPayload>(
      DOCUMENT_THUMBNAIL_JOB,
      (p, ctx) => this.thumbnail(p, ctx),
    );
  }

  /** Scan a version's bytes; quarantine stays until this clears it. */
  private async scan(payload: DocumentScanPayload, ctx: JobContext): Promise<void> {
    const version = await ctx.client.documentVersion.findFirst({
      where: { id: payload.versionId, documentId: payload.documentId },
    });
    if (!version) {
      this.logger.warn(`scan: version ${payload.versionId} gone; skipping`);
      return;
    }

    let verdict: 'clean' | 'infected' | 'error';
    let detail: string | undefined;
    try {
      const object = await this.storage.get(version.objectKey);
      const result = await this.scanner.scan(object.data);
      verdict = result.verdict;
      detail = result.detail;
    } catch (e) {
      verdict = 'error';
      detail = e instanceof Error ? e.message : String(e);
    }

    await ctx.client.documentVersion.update({
      where: { id: version.id },
      data: { scanStatus: verdict, scanDetail: detail ?? null },
    });

    // Reflect on the document only if this is still its current version.
    const doc = await ctx.client.document.findFirst({
      where: { id: payload.documentId },
      select: { currentVersionId: true, tenantId: true },
    });
    if (doc?.currentVersionId === version.id) {
      await ctx.client.document.update({
        where: { id: payload.documentId },
        data: { scanStatus: verdict },
      });
    }

    // A clean image gets a thumbnail (enqueued in the same tenant scope).
    if (verdict === 'clean' && version.mime.startsWith('image/')) {
      await this.jobs.enqueue({
        type: DOCUMENT_THUMBNAIL_JOB,
        tenantId: ctx.tenantId,
        idempotencyKey: `thumb:${version.id}`,
        payload: {
          documentId: payload.documentId,
          versionId: version.id,
        } satisfies DocumentThumbnailPayload,
      });
    }
  }

  /**
   * Thumbnail generation. In dev this records the derived thumbnail key and
   * stores the original bytes under it as a placeholder — real image resizing
   * (sharp/vips) slots in here behind the same job without changing producers.
   */
  private async thumbnail(
    payload: DocumentThumbnailPayload,
    ctx: JobContext,
  ): Promise<void> {
    const version = await ctx.client.documentVersion.findFirst({
      where: { id: payload.versionId, documentId: payload.documentId },
    });
    if (!version || version.thumbnailKey) return;

    const thumbnailKey = `${version.objectKey}.thumb`;
    try {
      const object = await this.storage.get(version.objectKey);
      await this.storage.put(thumbnailKey, object.data, version.mime);
    } catch (e) {
      this.logger.warn(
        `thumbnail: could not derive for ${version.id}: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
      return;
    }
    await ctx.client.documentVersion.update({
      where: { id: version.id },
      data: { thumbnailKey },
    });
  }
}
