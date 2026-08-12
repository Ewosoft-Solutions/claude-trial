/**
 * WB3-3 · versioned application form + typed responses.
 *
 * Two layers, mirroring the requirements engine's template/snapshot split:
 *   • versions   — per-tenant AdmissionFormVersion rows. A version is a DRAFT
 *                  until published; publishing supersedes the prior published
 *                  version (archived) and a published version is IMMUTABLE —
 *                  editing forks a fresh draft. One published version is
 *                  "current" at a time.
 *   • responses  — an application's answers to the current published version.
 *                  Answers are validated by field type, then the response
 *                  SNAPSHOTS the version number + field defs so a later form
 *                  edit never rewrites captured answers.
 *
 * Runs on the request's tenant-scoped client (RLS) inside the @TenantScoped tx;
 * audited; no privileged DatabaseService.
 */
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@workspace/database';

import { TenantDbService } from '../../common/database/tenant-db.service';
import { AuditService } from '../../common/audit/audit.service';
import { AUDIT_EVENT } from '../../common/audit/audit.constants';
import { DocumentService } from '../../documents/services/document.service';
import {
  OPTION_FIELD_TYPES,
  type CreateFormVersionDto,
  type FormFieldDto,
  type SubmitFormResponseDto,
  type UpdateFormVersionDto,
} from '../dto/admission-forms.dto';

/** A `file` field's persisted answer — a reference to the stored F4 document. */
interface FileAnswer {
  documentId: string;
  filename: string;
  mime?: string;
  size?: number;
}

@Injectable()
export class AdmissionFormsService {
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
    metadata?: Record<string, unknown>,
  ) {
    await this.audit.write({
      tenantId,
      eventType: AUDIT_EVENT.DATA_CHANGE,
      action,
      resource: 'admission_form',
      resourceId,
      actorId,
      description,
      metadata,
    });
  }

  // ======================= versions =======================

  /** Every version of the tenant's application form, newest first. */
  async listVersions(tenantId: string) {
    return this.client.admissionFormVersion.findMany({
      where: { tenantId },
      orderBy: { version: 'desc' },
    });
  }

  /** The single published ("current") version, or null if none is published. */
  async getCurrentForm(tenantId: string) {
    return this.client.admissionFormVersion.findFirst({
      where: { tenantId, status: 'published' },
      orderBy: { version: 'desc' },
    });
  }

  async getVersion(tenantId: string, id: string) {
    const version = await this.client.admissionFormVersion.findFirst({
      where: { id, tenantId },
    });
    if (!version) throw new NotFoundException('Form version not found');
    return version;
  }

  /** Create a new DRAFT version (the next sequential number for the tenant). */
  async createDraft(
    tenantId: string,
    actorId: string,
    dto: CreateFormVersionDto,
  ) {
    this.assertFields(dto.fields);
    const latest = await this.client.admissionFormVersion.findFirst({
      where: { tenantId },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    const version = (latest?.version ?? 0) + 1;

    const created = await this.client.admissionFormVersion.create({
      data: {
        tenantId,
        version,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        status: 'draft',
        fields: dto.fields as unknown as Prisma.InputJsonValue,
        createdBy: actorId,
        updatedBy: actorId,
      },
    });
    await this.writeAudit(
      tenantId,
      actorId,
      'admissions.form.create_draft',
      created.id,
      `created application form draft v${version} (${created.title})`,
    );
    return created;
  }

  /** Edit a DRAFT version. Published/archived versions are immutable. */
  async updateDraft(
    tenantId: string,
    actorId: string,
    id: string,
    dto: UpdateFormVersionDto,
  ) {
    const version = await this.getVersion(tenantId, id);
    if (version.status !== 'draft') {
      throw new BadRequestException(
        'Only a draft form can be edited — publish forks a new draft to change a live form.',
      );
    }
    if (dto.fields) this.assertFields(dto.fields);

    const updated = await this.client.admissionFormVersion.update({
      where: { id },
      data: {
        title: dto.title?.trim(),
        description:
          dto.description === undefined
            ? undefined
            : dto.description.trim() || null,
        fields:
          dto.fields === undefined
            ? undefined
            : (dto.fields as unknown as Prisma.InputJsonValue),
        updatedBy: actorId,
      },
    });
    await this.writeAudit(
      tenantId,
      actorId,
      'admissions.form.update_draft',
      id,
      `edited application form draft v${version.version}`,
    );
    return updated;
  }

  /**
   * Publish a draft: it becomes the current form and any previously published
   * version is archived. Atomic within the request's @TenantScoped tx.
   */
  async publishVersion(tenantId: string, actorId: string, id: string) {
    const version = await this.getVersion(tenantId, id);
    if (version.status === 'published') {
      throw new ConflictException('This version is already published.');
    }
    if (version.status === 'archived') {
      throw new BadRequestException(
        'An archived version cannot be published — duplicate it into a new draft.',
      );
    }
    const fields = version.fields as unknown as FormFieldDto[];
    if (!Array.isArray(fields) || fields.length === 0) {
      throw new BadRequestException(
        'Add at least one field before publishing the form.',
      );
    }

    // Archive whatever is currently published (there should be at most one).
    await this.client.admissionFormVersion.updateMany({
      where: { tenantId, status: 'published' },
      data: { status: 'archived', updatedBy: actorId },
    });

    const published = await this.client.admissionFormVersion.update({
      where: { id },
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
      'admissions.form.publish',
      id,
      `published application form v${version.version} (${published.title})`,
    );
    return published;
  }

  /** Archive a version (a school retiring a form without publishing a new one). */
  async archiveVersion(tenantId: string, actorId: string, id: string) {
    const version = await this.getVersion(tenantId, id);
    if (version.status === 'archived') return version;
    const archived = await this.client.admissionFormVersion.update({
      where: { id },
      data: { status: 'archived', updatedBy: actorId },
    });
    await this.writeAudit(
      tenantId,
      actorId,
      'admissions.form.archive',
      id,
      `archived application form v${version.version}`,
    );
    return archived;
  }

  // ======================= responses =======================

  /** The application's latest response (by form version), if any. */
  async getResponse(tenantId: string, applicationId: string) {
    await this.assertApplication(tenantId, applicationId);
    return this.client.admissionFormResponse.findFirst({
      where: { tenantId, applicationId },
      orderBy: { formVersion: 'desc' },
    });
  }

  /**
   * Submit (or re-submit) an application's answers to the current published
   * form. Answers are validated by field type, then the response snapshots the
   * version number + field defs. One response per application per version.
   */
  async submitResponse(
    tenantId: string,
    applicationId: string,
    actorId: string,
    dto: SubmitFormResponseDto,
  ) {
    await this.assertApplication(tenantId, applicationId);
    const current = await this.getCurrentForm(tenantId);
    if (!current) {
      throw new BadRequestException(
        'No published application form to respond to.',
      );
    }
    const fields = current.fields as unknown as FormFieldDto[];
    const answers = await this.validateAnswers(
      tenantId,
      applicationId,
      actorId,
      fields,
      dto.answers,
    );

    const response = await this.client.admissionFormResponse.upsert({
      where: {
        applicationId_formVersionId: {
          applicationId,
          formVersionId: current.id,
        },
      },
      create: {
        tenantId,
        applicationId,
        formVersionId: current.id,
        formVersion: current.version,
        fieldsSnapshot: current.fields as Prisma.InputJsonValue,
        answers: answers as Prisma.InputJsonValue,
        submittedBy: actorId,
      },
      update: {
        answers: answers as Prisma.InputJsonValue,
        submittedBy: actorId,
      },
    });
    await this.writeAudit(
      tenantId,
      actorId,
      'admissions.form.respond',
      response.id,
      `captured application-form response (v${current.version}) on application ${applicationId}`,
    );
    return response;
  }

  // ======================= validation =======================

  /** Structural validation of a version's field list (keys + option sets). */
  private assertFields(fields: FormFieldDto[]) {
    const seen = new Set<string>();
    for (const field of fields) {
      const key = field.key?.trim();
      if (!key) throw new BadRequestException('Every field needs a key.');
      if (seen.has(key)) {
        throw new BadRequestException(`Duplicate field key "${key}".`);
      }
      seen.add(key);
      if (OPTION_FIELD_TYPES.includes(field.type)) {
        const options = (field.options ?? [])
          .map((o) => o.trim())
          .filter(Boolean);
        if (options.length === 0) {
          throw new BadRequestException(
            `Field "${key}" (${field.type}) needs at least one option.`,
          );
        }
      }
    }
  }

  /**
   * Validate an answer set against the published field defs by type, returning
   * the cleaned answers (unknown keys rejected; empty required fields rejected).
   */
  private async validateAnswers(
    tenantId: string,
    applicationId: string,
    actorId: string,
    fields: FormFieldDto[],
    answers: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const byKey = new Map(fields.map((f) => [f.key, f]));
    for (const key of Object.keys(answers)) {
      if (!byKey.has(key)) {
        throw new BadRequestException(`"${key}" is not a field on this form.`);
      }
    }

    const cleaned: Record<string, unknown> = {};
    for (const field of fields) {
      const raw = answers[field.key];
      const empty =
        raw === undefined ||
        raw === null ||
        raw === '' ||
        (Array.isArray(raw) && raw.length === 0);
      if (empty) {
        if (field.required) {
          throw new BadRequestException(`"${field.label}" is required.`);
        }
        continue;
      }
      cleaned[field.key] = await this.coerceAnswer(
        tenantId,
        applicationId,
        actorId,
        field,
        raw,
      );
    }
    return cleaned;
  }

  private async coerceAnswer(
    tenantId: string,
    applicationId: string,
    actorId: string,
    field: FormFieldDto,
    raw: unknown,
  ): Promise<unknown> {
    switch (field.type) {
      case 'text':
      case 'paragraph': {
        if (typeof raw !== 'string') {
          throw new BadRequestException(`"${field.label}" must be text.`);
        }
        return raw;
      }
      case 'number': {
        const n = typeof raw === 'number' ? raw : Number(raw);
        if (!Number.isFinite(n)) {
          throw new BadRequestException(`"${field.label}" must be a number.`);
        }
        return n;
      }
      case 'date': {
        if (typeof raw !== 'string' || Number.isNaN(Date.parse(raw))) {
          throw new BadRequestException(`"${field.label}" must be a date.`);
        }
        return raw;
      }
      case 'boolean': {
        if (typeof raw !== 'boolean') {
          throw new BadRequestException(`"${field.label}" must be yes/no.`);
        }
        return raw;
      }
      case 'select': {
        const options = field.options ?? [];
        if (typeof raw !== 'string' || !options.includes(raw)) {
          throw new BadRequestException(
            `"${field.label}" must be one of its options.`,
          );
        }
        return raw;
      }
      case 'multiselect': {
        if (!Array.isArray(raw)) {
          throw new BadRequestException(
            `"${field.label}" must be a list of options.`,
          );
        }
        const options = field.options ?? [];
        for (const v of raw) {
          if (typeof v !== 'string' || !options.includes(v)) {
            throw new BadRequestException(
              `"${field.label}" has an invalid option.`,
            );
          }
        }
        return raw;
      }
      case 'file':
        return this.coerceFileAnswer(
          tenantId,
          applicationId,
          actorId,
          field,
          raw,
        );
      default:
        throw new BadRequestException(
          `Unsupported field type on "${field.label}".`,
        );
    }
  }

  /**
   * A `file` answer is either a NEW upload ({ filename, mime, contentBase64 })
   * — stored through F4/R2 and reduced to a document reference — or an EXISTING
   * reference ({ documentId, filename }) on a re-submit, which is passed through
   * only after we confirm the document belongs to THIS application (so a client
   * can't attach another application's — or another tenant's — document).
   */
  private async coerceFileAnswer(
    tenantId: string,
    applicationId: string,
    actorId: string,
    field: FormFieldDto,
    raw: unknown,
  ): Promise<FileAnswer> {
    if (!raw || typeof raw !== 'object') {
      throw new BadRequestException(
        `"${field.label}" must be an uploaded file.`,
      );
    }
    const v = raw as Record<string, unknown>;

    // Existing reference (unchanged on re-submit).
    if (typeof v.documentId === 'string' && v.documentId) {
      const doc = await this.client.document.findFirst({
        where: {
          id: v.documentId,
          tenantId,
          ownerType: 'AdmissionApplication',
          ownerId: applicationId,
        },
        select: { id: true },
      });
      if (!doc) {
        throw new BadRequestException(
          `"${field.label}" refers to a file that isn't on this application.`,
        );
      }
      return {
        documentId: doc.id,
        filename: typeof v.filename === 'string' ? v.filename : 'file',
        mime: typeof v.mime === 'string' ? v.mime : undefined,
        size: typeof v.size === 'number' ? v.size : undefined,
      };
    }

    // New upload.
    if (typeof v.contentBase64 === 'string' && v.contentBase64) {
      const content = Buffer.from(v.contentBase64, 'base64');
      if (content.length === 0) {
        throw new BadRequestException(`"${field.label}" file is empty.`);
      }
      const filename =
        typeof v.filename === 'string' && v.filename ? v.filename : 'upload';
      const doc = await this.documents.upload(tenantId, actorId, {
        ownerType: 'AdmissionApplication',
        ownerId: applicationId,
        title: `${field.label} — ${filename}`,
        visibility: 'private',
        sensitive: true,
        mime: typeof v.mime === 'string' ? v.mime : 'application/octet-stream',
        filename,
        content,
        sourceSystem: 'admissions',
        sourceId: `form-field:${field.key}`,
      });
      return {
        documentId: doc.id,
        filename,
        mime: typeof v.mime === 'string' ? v.mime : undefined,
        size: content.length,
      };
    }

    throw new BadRequestException(`"${field.label}" must be an uploaded file.`);
  }

  private async assertApplication(tenantId: string, id: string) {
    const app = await this.client.admissionApplication.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });
    if (!app) throw new NotFoundException('Application not found');
    return app;
  }
}
