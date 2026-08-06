/**
 * WB3 structured-intake · admissions requirements engine.
 *
 * Two layers:
 *   • template     — the per-tenant, editable set of AdmissionRequirement rows
 *                    (what the school collects, and at which stage). Seeded on
 *                    demand from {@link DEFAULT_ADMISSION_REQUIREMENTS}.
 *   • fulfilments  — when an application is created, the active template is
 *                    SNAPSHOTTED into AdmissionApplicationRequirement rows so a
 *                    later template edit never rewrites an in-flight file. Each
 *                    is then provided (typed value / uploaded document / settled
 *                    fee) or waived, tracked to its collection stage.
 *
 * Runs on the request's tenant-scoped client (RLS) inside the @TenantScoped tx;
 * document bytes go through the F4 DocumentService → StorageProvider (R2). No
 * privileged DatabaseService.
 */
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@workspace/database';

import { TenantDbService } from '../../common/database/tenant-db.service';
import { AuditService } from '../../common/audit/audit.service';
import { AUDIT_EVENT } from '../../common/audit/audit.constants';
import { DocumentService } from '../../documents/services/document.service';
import {
  DEFAULT_ADMISSION_REQUIREMENTS,
  RequirementSeed,
} from '../admission-requirements.constants';
import type {
  CreateRequirementDto,
  ProvideRequirementDto,
  UpdateRequirementDto,
  UploadRequirementDocumentDto,
  WaiveRequirementDto,
} from '../dto/admissions.dto';

@Injectable()
export class AdmissionRequirementsService {
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
      resource: 'admission_requirement',
      resourceId,
      actorId,
      description,
      metadata,
    });
  }

  // ======================= template =======================

  /** The tenant's requirement template (ordered), optionally active-only. */
  async listTemplate(tenantId: string, activeOnly = false) {
    return this.client.admissionRequirement.findMany({
      where: { tenantId, ...(activeOnly ? { active: true } : {}) },
      orderBy: [{ collectStage: 'asc' }, { order: 'asc' }, { label: 'asc' }],
    });
  }

  /**
   * Seed the default checklist if the tenant has none yet — idempotent: only the
   * keys not already present are inserted, so a school's edits are never undone.
   * Returns the number of requirements created.
   */
  async ensureDefaults(tenantId: string, actorId: string): Promise<number> {
    const existing = await this.client.admissionRequirement.findMany({
      where: { tenantId },
      select: { key: true },
    });
    const present = new Set(existing.map((r) => r.key));
    const missing = DEFAULT_ADMISSION_REQUIREMENTS.filter(
      (r) => !present.has(r.key),
    );
    if (missing.length === 0) return 0;

    await this.client.admissionRequirement.createMany({
      data: missing.map((r: RequirementSeed) => ({
        tenantId,
        key: r.key,
        label: r.label,
        type: r.type,
        collectStage: r.collectStage,
        required: r.required,
        order: r.order,
        config: (r.config ?? undefined) as Prisma.InputJsonValue | undefined,
        createdBy: actorId,
        updatedBy: actorId,
      })),
      skipDuplicates: true,
    });
    await this.writeAudit(
      tenantId,
      actorId,
      'admissions.requirements.seed_defaults',
      tenantId,
      `seeded ${missing.length} default admission requirement(s)`,
      { keys: missing.map((r) => r.key) },
    );
    return missing.length;
  }

  async createRequirement(
    tenantId: string,
    actorId: string,
    dto: CreateRequirementDto,
  ) {
    const key = dto.key.trim();
    const clash = await this.client.admissionRequirement.findFirst({
      where: { tenantId, key },
      select: { id: true },
    });
    if (clash) {
      throw new BadRequestException(
        `A requirement with key "${key}" already exists.`,
      );
    }
    const requirement = await this.client.admissionRequirement.create({
      data: {
        tenantId,
        key,
        label: dto.label.trim(),
        type: dto.type,
        collectStage: dto.collectStage,
        required: dto.required ?? true,
        order: dto.order ?? 0,
        config: (dto.config ?? undefined) as Prisma.InputJsonValue | undefined,
        createdBy: actorId,
        updatedBy: actorId,
      },
    });
    await this.writeAudit(
      tenantId,
      actorId,
      'admissions.requirements.create',
      requirement.id,
      `added admission requirement ${requirement.label}`,
    );
    return requirement;
  }

  async updateRequirement(
    tenantId: string,
    actorId: string,
    id: string,
    dto: UpdateRequirementDto,
  ) {
    await this.assertRequirement(tenantId, id);
    const requirement = await this.client.admissionRequirement.update({
      where: { id },
      data: {
        label: dto.label?.trim(),
        collectStage: dto.collectStage,
        required: dto.required,
        active: dto.active,
        order: dto.order,
        config:
          dto.config === undefined
            ? undefined
            : (dto.config as Prisma.InputJsonValue),
        updatedBy: actorId,
      },
    });
    await this.writeAudit(
      tenantId,
      actorId,
      'admissions.requirements.update',
      id,
      `updated admission requirement ${requirement.label}`,
    );
    return requirement;
  }

  // ======================= fulfilments =======================

  /**
   * Snapshot the active template onto an application. Seeds the defaults first
   * when the tenant has no template yet, so structured intake works out of the
   * box. Idempotent — re-running only adds requirements not already attached.
   */
  async instantiateForApplication(
    tenantId: string,
    applicationId: string,
    actorId: string,
  ) {
    let template = await this.listTemplate(tenantId, true);
    if (template.length === 0) {
      await this.ensureDefaults(tenantId, actorId);
      template = await this.listTemplate(tenantId, true);
    }

    const attached = await this.client.admissionApplicationRequirement.findMany(
      {
        where: { tenantId, applicationId },
        select: { requirementId: true },
      },
    );
    const have = new Set(attached.map((r) => r.requirementId));
    const toAdd = template.filter((r) => !have.has(r.id));
    if (toAdd.length === 0) return { created: 0 };

    await this.client.admissionApplicationRequirement.createMany({
      data: toAdd.map((r) => ({
        tenantId,
        applicationId,
        requirementId: r.id,
        label: r.label,
        type: r.type,
        collectStage: r.collectStage,
        required: r.required,
      })),
      skipDuplicates: true,
    });
    return { created: toAdd.length };
  }

  /** The application's requirement checklist (ordered by stage). */
  async listForApplication(tenantId: string, applicationId: string) {
    return this.client.admissionApplicationRequirement.findMany({
      where: { tenantId, applicationId },
      orderBy: [{ collectStage: 'asc' }, { label: 'asc' }],
    });
  }

  async provideRequirement(
    tenantId: string,
    applicationId: string,
    appRequirementId: string,
    dto: ProvideRequirementDto,
    actorId: string,
  ) {
    const req = await this.assertApplicationRequirement(
      tenantId,
      applicationId,
      appRequirementId,
    );
    if (req.type === 'document') {
      throw new BadRequestException(
        'This is a document requirement — upload the file instead.',
      );
    }
    const updated = await this.client.admissionApplicationRequirement.update({
      where: { id: appRequirementId },
      data: {
        status: 'provided',
        value:
          dto.value === undefined
            ? undefined
            : (dto.value as Prisma.InputJsonValue),
        providedAt: new Date(),
        providedBy: actorId,
        waivedReason: null,
      },
    });
    await this.writeAudit(
      tenantId,
      actorId,
      'admissions.requirements.provide',
      appRequirementId,
      `provided requirement "${req.label}" on application ${applicationId}`,
    );
    return updated;
  }

  async waiveRequirement(
    tenantId: string,
    applicationId: string,
    appRequirementId: string,
    dto: WaiveRequirementDto,
    actorId: string,
  ) {
    const req = await this.assertApplicationRequirement(
      tenantId,
      applicationId,
      appRequirementId,
    );
    const updated = await this.client.admissionApplicationRequirement.update({
      where: { id: appRequirementId },
      data: {
        status: 'waived',
        waivedReason: dto.reason.trim(),
        providedAt: new Date(),
        providedBy: actorId,
      },
    });
    await this.writeAudit(
      tenantId,
      actorId,
      'admissions.requirements.waive',
      appRequirementId,
      `waived requirement "${req.label}" on application ${applicationId}`,
      { reason: dto.reason.trim() },
    );
    return updated;
  }

  async uploadRequirementDocument(
    tenantId: string,
    applicationId: string,
    appRequirementId: string,
    dto: UploadRequirementDocumentDto,
    actorId: string,
  ) {
    const req = await this.assertApplicationRequirement(
      tenantId,
      applicationId,
      appRequirementId,
    );
    if (req.type !== 'document') {
      throw new BadRequestException(
        'This requirement is not a document — provide its value instead.',
      );
    }
    const content = Buffer.from(dto.contentBase64, 'base64');
    if (content.length === 0) {
      throw new BadRequestException('Empty file');
    }

    // Store the binary through F4 (→ StorageProvider/R2). The application owns
    // the document; the fulfilment id is the source ref so the two stay linked.
    const doc = await this.documents.upload(tenantId, actorId, {
      ownerType: 'AdmissionApplication',
      ownerId: applicationId,
      title: `${req.label} — ${dto.filename ?? 'upload'}`,
      visibility: 'private',
      sensitive: true,
      mime: dto.mime,
      filename: dto.filename,
      content,
      sourceSystem: 'admissions',
      sourceId: appRequirementId,
    });

    const updated = await this.client.admissionApplicationRequirement.update({
      where: { id: appRequirementId },
      data: {
        status: 'provided',
        documentId: doc.id,
        providedAt: new Date(),
        providedBy: actorId,
        waivedReason: null,
      },
    });
    await this.writeAudit(
      tenantId,
      actorId,
      'admissions.requirements.upload',
      appRequirementId,
      `uploaded "${req.label}" on application ${applicationId}`,
      { documentId: doc.id, mime: dto.mime },
    );
    return updated;
  }

  // ======================= helpers =======================

  private async assertRequirement(tenantId: string, id: string) {
    const req = await this.client.admissionRequirement.findFirst({
      where: { id, tenantId },
    });
    if (!req) throw new NotFoundException('Requirement not found');
    return req;
  }

  private async assertApplicationRequirement(
    tenantId: string,
    applicationId: string,
    id: string,
  ) {
    const req = await this.client.admissionApplicationRequirement.findFirst({
      where: { id, tenantId, applicationId },
    });
    if (!req) {
      throw new NotFoundException('Application requirement not found');
    }
    return req;
  }
}
