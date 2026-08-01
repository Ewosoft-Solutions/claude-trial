import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { Prisma } from '@workspace/database';
import { DatabaseService } from '../../common/database/database.service';
import { TenantDbService } from '../../common/database/tenant-db.service';
import { JobService } from '../../common/jobs/job.service';
import { STORAGE_PROVIDER } from '../../common/storage/storage.types';
import type { StorageProvider } from '../../common/storage/storage.types';
import { writeAuditLog } from '../../common/audit/audit-writer';
import { AUDIT_EVENT } from '../../common/audit/audit.constants';
import { DocumentUrlSigner } from '../storage/document-url-signer';
import { DOCUMENT_SCAN_JOB, DocumentScanPayload } from '../jobs/document-jobs';

export interface UploadDocumentInput {
  ownerType: string;
  ownerId: string;
  typeKey?: string;
  title?: string;
  visibility?: string;
  sensitive?: boolean;
  mime: string;
  filename?: string;
  /** raw bytes */
  content: Buffer;
  sourceSystem?: string;
  sourceId?: string;
}

/**
 * Document/attachment service (F4 / ADR-08). Logical Document vs stored
 * DocumentVersion; bytes live behind the StorageProvider port keyed by tenant.
 * Uploads are quarantined until an F3 scan job clears them; access is a signed,
 * short-lived URL minted only after a server-side permission check and audited.
 */
@Injectable()
export class DocumentService {
  constructor(
    private readonly db: DatabaseService,
    private readonly tenantDb: TenantDbService,
    private readonly jobs: JobService,
    private readonly signer: DocumentUrlSigner,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  private get client(): Prisma.TransactionClient {
    return (
      this.tenantDb.isScoped ? this.tenantDb.client : this.db.client
    ) as Prisma.TransactionClient;
  }

  private objectKey(
    tenantId: string,
    documentId: string,
    versionNo: number,
    versionId: string,
  ): string {
    return `tenants/${tenantId}/documents/${documentId}/v${versionNo}/${versionId}`;
  }

  async upload(
    tenantId: string,
    actorId: string | undefined,
    input: UploadDocumentInput,
  ) {
    if (!input.content?.length) {
      throw new BadRequestException('Empty file');
    }
    const client = this.client;

    const typeId = input.typeKey
      ? ((
          await client.documentType.findUnique({
            where: { tenantId_key: { tenantId, key: input.typeKey } },
            select: {
              id: true,
              defaultVisibility: true,
              isSignatureAsset: true,
            },
          })
        )?.id ?? null)
      : null;

    const documentId = randomUUID();
    const versionId = randomUUID();
    const objectKey = this.objectKey(tenantId, documentId, 1, versionId);
    const checksum = createHash('sha256').update(input.content).digest('hex');

    const document = await client.document.create({
      data: {
        id: documentId,
        tenantId,
        typeId,
        ownerType: input.ownerType,
        ownerId: input.ownerId,
        title: input.title ?? input.filename ?? null,
        visibility: input.visibility ?? 'private',
        sensitive: input.sensitive ?? false,
        scanStatus: 'pending',
        sourceSystem: input.sourceSystem ?? null,
        sourceId: input.sourceId ?? null,
        createdBy: actorId ?? null,
      },
    });

    await client.documentVersion.create({
      data: {
        id: versionId,
        tenantId,
        documentId,
        versionNo: 1,
        objectKey,
        checksum,
        mime: input.mime,
        size: input.content.length,
        scanStatus: 'pending',
        createdBy: actorId ?? null,
      },
    });

    // Persist the bytes AFTER the rows exist (so a DB failure leaves no orphan
    // blob); the storage write itself is not transactional.
    await this.storage.put(objectKey, input.content, input.mime);

    await client.document.update({
      where: { id: documentId },
      data: { currentVersionId: versionId },
    });

    // Scan runs on F3 — idempotent on the version id, atomic with this tx.
    await this.jobs.enqueue({
      type: DOCUMENT_SCAN_JOB,
      tenantId,
      idempotencyKey: `scan:${versionId}`,
      actorId: actorId ?? null,
      payload: { documentId, versionId } satisfies DocumentScanPayload,
    });

    await this.audit(tenantId, actorId, 'document.upload', documentId, {
      versionId,
      mime: input.mime,
      size: input.content.length,
    });

    return { ...document, currentVersionId: versionId, versionId, checksum };
  }

  async get(tenantId: string, id: string) {
    const doc = await this.client.document.findFirst({
      where: { id, tenantId },
      include: {
        versions: { orderBy: { versionNo: 'desc' } },
        type: { select: { key: true, label: true, isSignatureAsset: true } },
      },
    });
    if (!doc) throw new NotFoundException('Document not found');
    return doc;
  }

  /**
   * List documents for an owner. Signature-asset documents are **never** listed
   * (ADR-08 reject): they are reachable only via an authorized signature flow.
   */
  async listForOwner(tenantId: string, ownerType: string, ownerId: string) {
    return this.client.document.findMany({
      where: {
        tenantId,
        ownerType,
        ownerId,
        NOT: { ownerType: 'SignatureAsset' },
      },
      orderBy: { createdAt: 'desc' },
      include: { type: { select: { key: true, label: true } } },
    });
  }

  /**
   * Mint a signed, short-lived download URL — only after the caller passed the
   * server-side permission check. A sensitive document additionally requires
   * `documents.download_sensitive` (the controller passes the decision here).
   * The current version must have scanned clean, or the download is refused.
   */
  async mintDownloadUrl(
    tenantId: string,
    actorId: string | undefined,
    documentId: string,
    canDownloadSensitive: boolean,
  ) {
    const doc = await this.client.document.findFirst({
      where: { id: documentId, tenantId },
      select: {
        id: true,
        sensitive: true,
        currentVersionId: true,
        scanStatus: true,
      },
    });
    if (!doc) throw new NotFoundException('Document not found');
    if (doc.sensitive && !canDownloadSensitive) {
      throw new ForbiddenException('Not authorized to download this document');
    }
    if (!doc.currentVersionId) {
      throw new ConflictException('Document has no stored version');
    }
    if (doc.scanStatus !== 'clean') {
      throw new ConflictException(
        `Document is not available for download (scan status: ${doc.scanStatus})`,
      );
    }

    const { token, expiresAt } = this.signer.sign({
      tenantId,
      documentId,
      versionId: doc.currentVersionId,
    });
    await this.audit(tenantId, actorId, 'document.download_url', documentId, {
      versionId: doc.currentVersionId,
      sensitive: doc.sensitive,
    });
    return {
      url: `/documents/download?token=${encodeURIComponent(token)}`,
      token,
      expiresAt,
    };
  }

  /**
   * Resolve a signed token to the actual bytes. The token is the capability
   * (HMAC-bound to tenant/document/version/expiry); we re-check scope + scan
   * status, then audit the download.
   */
  async resolveDownload(
    tenantId: string,
    actorId: string | undefined,
    token: string,
  ) {
    const claims = this.signer.verify(token);
    if (!claims)
      throw new ForbiddenException('Invalid or expired download link');
    if (claims.tenantId !== tenantId) {
      throw new ForbiddenException('Invalid or expired download link');
    }

    const version = await this.client.documentVersion.findFirst({
      where: { id: claims.versionId, documentId: claims.documentId, tenantId },
    });
    if (!version) throw new NotFoundException('Document version not found');
    if (version.scanStatus !== 'clean') {
      throw new ConflictException('Document is not available for download');
    }

    const object = await this.storage.get(version.objectKey);
    await this.audit(
      tenantId,
      actorId,
      'document.download',
      claims.documentId,
      {
        versionId: version.id,
      },
    );
    return {
      buffer: object.data,
      mime: version.mime,
      filename: claims.documentId,
      checksum: version.checksum,
    };
  }

  async setLegalHold(
    tenantId: string,
    actorId: string | undefined,
    documentId: string,
    hold: boolean,
  ) {
    await this.ensureExists(tenantId, documentId);
    await this.client.document.update({
      where: { id: documentId },
      data: { legalHold: hold },
    });
    await this.audit(
      tenantId,
      actorId,
      hold ? 'document.legal_hold.set' : 'document.legal_hold.release',
      documentId,
      {},
    );
    return { documentId, legalHold: hold };
  }

  async delete(
    tenantId: string,
    actorId: string | undefined,
    documentId: string,
  ) {
    const doc = await this.client.document.findFirst({
      where: { id: documentId, tenantId },
      include: { versions: { select: { objectKey: true } } },
    });
    if (!doc) throw new NotFoundException('Document not found');
    if (doc.legalHold) {
      throw new ConflictException(
        'Document is under legal hold and cannot be deleted',
      );
    }
    // Delete rows first (cascade removes versions), then best-effort purge blobs.
    await this.client.document.delete({ where: { id: documentId } });
    for (const v of doc.versions) {
      await this.storage.delete(v.objectKey).catch(() => undefined);
    }
    await this.audit(tenantId, actorId, 'document.delete', documentId, {
      versions: doc.versions.length,
    });
    return { deleted: true };
  }

  private async ensureExists(tenantId: string, documentId: string) {
    const doc = await this.client.document.findFirst({
      where: { id: documentId, tenantId },
      select: { id: true },
    });
    if (!doc) throw new NotFoundException('Document not found');
  }

  private async audit(
    tenantId: string,
    actorId: string | undefined,
    action: string,
    resourceId: string,
    metadata: Record<string, unknown>,
  ) {
    const sensitive =
      action === 'document.download' || action === 'document.download_url';
    await writeAuditLog(this.db.client, {
      tenantId,
      eventType: sensitive
        ? AUDIT_EVENT.SECURITY_EVENT
        : AUDIT_EVENT.DATA_CHANGE,
      action,
      resource: 'document',
      resourceId,
      actorId: actorId ?? null,
      description: `${action} ${resourceId}`,
      metadata,
    });
  }
}
