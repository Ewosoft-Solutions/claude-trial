/**
 * Form Engine (P1) — the generic, reusable Forms service.
 *
 * A domain (admissions, HR, …) owns a Form polymorphically (ownerType/ownerId)
 * under a `purpose`, versions its definition (draft → published → archived; a
 * published version is immutable), and captures a SUBJECT's answers as a
 * FormResponse that snapshots the definition. Runs on the request's tenant-scoped
 * client (RLS) — no privileged client — and is audited. Answer validation is the
 * pure validator; `file` items are materialised through F4 here.
 */
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@workspace/database';

import { TenantDbService } from '../common/database/tenant-db.service';
import { AuditService } from '../common/audit/audit.service';
import { AUDIT_EVENT } from '../common/audit/audit.constants';
import { DocumentService } from '../documents/services/document.service';
import {
  FormValidationError,
  fileItemKeys,
  isFileRef,
  isFileUploadMarker,
  validateAnswers,
  validateDefinition,
  type FormDefinition,
} from '@workspace/forms';

/** Locate a form within a tenant by who owns it + what it's for. */
export interface FormOwnerRef {
  ownerType: string;
  ownerId: string;
  purpose: string;
  key?: string | null;
}

@Injectable()
export class FormsService {
  constructor(
    private readonly tenantDb: TenantDbService,
    private readonly audit: AuditService,
    private readonly documents: DocumentService,
  ) {}

  private get client(): Prisma.TransactionClient {
    return this.tenantDb.client;
  }

  private async writeAudit(
    tenantId: string,
    actorId: string,
    action: string,
    resourceId: string,
    description: string,
  ) {
    await this.audit.write({
      tenantId,
      eventType: AUDIT_EVENT.DATA_CHANGE,
      action,
      resource: 'form',
      resourceId,
      actorId,
      description,
    });
  }

  // ======================= forms =======================

  async findForm(tenantId: string, ref: FormOwnerRef) {
    return this.client.form.findFirst({
      where: {
        tenantId,
        ownerType: ref.ownerType,
        ownerId: ref.ownerId,
        purpose: ref.purpose,
        key: ref.key ?? null,
      },
    });
  }

  /** Find the tenant's form for this owner/purpose, creating it if absent. */
  async getOrCreateForm(
    tenantId: string,
    actorId: string,
    ref: FormOwnerRef,
    title: string,
  ) {
    const existing = await this.findForm(tenantId, ref);
    if (existing) return existing;
    const form = await this.client.form.create({
      data: {
        tenantId,
        ownerType: ref.ownerType,
        ownerId: ref.ownerId,
        purpose: ref.purpose,
        key: ref.key ?? null,
        title: title.trim() || 'Untitled form',
        createdBy: actorId,
        updatedBy: actorId,
      },
    });
    await this.writeAudit(
      tenantId,
      actorId,
      'forms.form.create',
      form.id,
      `created form "${form.title}" (${ref.purpose})`,
    );
    return form;
  }

  async getForm(tenantId: string, formId: string) {
    const form = await this.client.form.findFirst({
      where: { id: formId, tenantId },
    });
    if (!form) throw new NotFoundException('Form not found');
    return form;
  }

  // ======================= versions =======================

  async listVersions(tenantId: string, formId: string) {
    return this.client.formVersion.findMany({
      where: { tenantId, formId },
      orderBy: { version: 'desc' },
    });
  }

  /** The single published ("current") version for a form, or null. */
  async getCurrentPublished(tenantId: string, formId: string) {
    return this.client.formVersion.findFirst({
      where: { tenantId, formId, status: 'published' },
      orderBy: { version: 'desc' },
    });
  }

  async getVersion(tenantId: string, versionId: string) {
    const version = await this.client.formVersion.findFirst({
      where: { id: versionId, tenantId },
    });
    if (!version) throw new NotFoundException('Form version not found');
    return version;
  }

  /** Create the next DRAFT version of a form. */
  async createDraft(
    tenantId: string,
    actorId: string,
    formId: string,
    definition: FormDefinition,
  ) {
    await this.getForm(tenantId, formId);
    this.assertDefinition(definition);
    const latest = await this.client.formVersion.findFirst({
      where: { tenantId, formId },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    const version = (latest?.version ?? 0) + 1;
    const created = await this.client.formVersion.create({
      data: {
        tenantId,
        formId,
        version,
        status: 'draft',
        definition: definition as unknown as Prisma.InputJsonValue,
        createdBy: actorId,
        updatedBy: actorId,
      },
    });
    await this.writeAudit(
      tenantId,
      actorId,
      'forms.version.create_draft',
      created.id,
      `created form draft v${version}`,
    );
    return created;
  }

  /** Edit a DRAFT version's definition (published/archived are immutable). */
  async updateDraft(
    tenantId: string,
    actorId: string,
    versionId: string,
    definition: FormDefinition,
  ) {
    const version = await this.getVersion(tenantId, versionId);
    if (version.status !== 'draft') {
      throw new BadRequestException(
        'Only a draft can be edited — publishing forks a new draft to change a live form.',
      );
    }
    this.assertDefinition(definition);
    const updated = await this.client.formVersion.update({
      where: { id: versionId },
      data: {
        definition: definition as unknown as Prisma.InputJsonValue,
        updatedBy: actorId,
      },
    });
    await this.writeAudit(
      tenantId,
      actorId,
      'forms.version.update_draft',
      versionId,
      `edited form draft v${version.version}`,
    );
    return updated;
  }

  /** Publish a draft; the prior published version (if any) is archived. */
  async publishVersion(tenantId: string, actorId: string, versionId: string) {
    const version = await this.getVersion(tenantId, versionId);
    if (version.status === 'published') {
      throw new ConflictException('This version is already published.');
    }
    if (version.status === 'archived') {
      throw new BadRequestException(
        'An archived version cannot be published — duplicate it into a new draft.',
      );
    }
    this.assertDefinition(version.definition as unknown as FormDefinition);

    await this.client.formVersion.updateMany({
      where: { tenantId, formId: version.formId, status: 'published' },
      data: { status: 'archived', updatedBy: actorId },
    });
    const published = await this.client.formVersion.update({
      where: { id: versionId },
      data: {
        status: 'published',
        publishedAt: new Date(),
        publishedBy: actorId,
        updatedBy: actorId,
      },
    });
    await this.writeAudit(
      tenantId,
      actorId,
      'forms.version.publish',
      versionId,
      `published form v${version.version}`,
    );
    return published;
  }

  async archiveVersion(tenantId: string, actorId: string, versionId: string) {
    const version = await this.getVersion(tenantId, versionId);
    if (version.status === 'archived') return version;
    const archived = await this.client.formVersion.update({
      where: { id: versionId },
      data: { status: 'archived', updatedBy: actorId },
    });
    await this.writeAudit(
      tenantId,
      actorId,
      'forms.version.archive',
      versionId,
      `archived form v${version.version}`,
    );
    return archived;
  }

  // ======================= responses =======================

  /**
   * Submit (or re-submit) a subject's answers to a specific published version.
   * Answers are validated, `file` uploads are materialised through F4, and the
   * response snapshots the definition + version. One response per subject per
   * version.
   */
  async submitResponse(
    tenantId: string,
    actorId: string,
    params: {
      formVersionId: string;
      subjectType: string;
      subjectId: string;
      answers: Record<string, unknown>;
    },
  ) {
    const version = await this.getVersion(tenantId, params.formVersionId);
    if (version.status === 'draft') {
      throw new BadRequestException('Cannot respond to a draft form.');
    }
    const definition = version.definition as unknown as FormDefinition;

    let cleaned: Record<string, unknown>;
    try {
      cleaned = validateAnswers(definition, params.answers);
    } catch (e) {
      if (e instanceof FormValidationError) {
        throw new BadRequestException(e.message);
      }
      throw e;
    }

    await this.materialiseFiles(
      tenantId,
      actorId,
      definition,
      params.subjectType,
      params.subjectId,
      cleaned,
    );

    const response = await this.client.formResponse.upsert({
      where: {
        formVersionId_subjectType_subjectId: {
          formVersionId: version.id,
          subjectType: params.subjectType,
          subjectId: params.subjectId,
        },
      },
      create: {
        tenantId,
        formVersionId: version.id,
        subjectType: params.subjectType,
        subjectId: params.subjectId,
        version: version.version,
        definitionSnapshot: version.definition as Prisma.InputJsonValue,
        answers: cleaned as Prisma.InputJsonValue,
        submittedBy: actorId,
      },
      update: {
        answers: cleaned as Prisma.InputJsonValue,
        submittedBy: actorId,
      },
    });
    await this.writeAudit(
      tenantId,
      actorId,
      'forms.response.submit',
      response.id,
      `captured a form response (v${version.version}) for ${params.subjectType} ${params.subjectId}`,
    );
    return response;
  }

  async getResponse(
    tenantId: string,
    formVersionId: string,
    subjectType: string,
    subjectId: string,
  ) {
    return this.client.formResponse.findFirst({
      where: { tenantId, formVersionId, subjectType, subjectId },
    });
  }

  // ======================= internals =======================

  private assertDefinition(definition: FormDefinition) {
    try {
      validateDefinition(definition);
    } catch (e) {
      if (e instanceof FormValidationError) {
        throw new BadRequestException(e.message);
      }
      throw e;
    }
  }

  /**
   * Turn each `file` answer into a stored document reference: a new upload marker
   * ({ contentBase64 }) is stored through F4 owned by the SUBJECT; an existing
   * { documentId } ref is accepted only if it belongs to the subject (so a client
   * can't attach another subject's — or tenant's — document).
   */
  private async materialiseFiles(
    tenantId: string,
    actorId: string,
    definition: FormDefinition,
    subjectType: string,
    subjectId: string,
    cleaned: Record<string, unknown>,
  ) {
    for (const key of fileItemKeys(definition)) {
      const val = cleaned[key];
      if (val === undefined) continue;

      if (isFileUploadMarker(val)) {
        const content = Buffer.from(val.contentBase64, 'base64');
        if (content.length === 0) {
          throw new BadRequestException(`"${key}" file is empty.`);
        }
        const doc = await this.documents.upload(tenantId, actorId, {
          ownerType: subjectType,
          ownerId: subjectId,
          title: `${key} — ${val.filename}`,
          visibility: 'private',
          sensitive: true,
          mime: val.mime ?? 'application/octet-stream',
          filename: val.filename,
          content,
          sourceSystem: 'forms',
          sourceId: `form-field:${key}`,
        });
        cleaned[key] = {
          documentId: doc.id,
          filename: val.filename,
          mime: val.mime,
          size: content.length,
        };
      } else if (isFileRef(val)) {
        const doc = await this.client.document.findFirst({
          where: {
            id: val.documentId,
            tenantId,
            ownerType: subjectType,
            ownerId: subjectId,
          },
          select: { id: true },
        });
        if (!doc) {
          throw new BadRequestException(
            `"${key}" refers to a file that isn't on this record.`,
          );
        }
      }
    }
  }
}
