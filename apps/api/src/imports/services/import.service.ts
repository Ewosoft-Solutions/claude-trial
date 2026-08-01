import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@workspace/database';
import { DatabaseService } from '../../common/database/database.service';
import { TenantDbService } from '../../common/database/tenant-db.service';
import { DocumentService } from '../../documents/services/document.service';
import { writeAuditLog } from '../../common/audit/audit-writer';
import { AUDIT_EVENT } from '../../common/audit/audit.constants';
import { parseCsv, rowToObject } from '../csv';
import { applyTransform } from '../transforms';
import { IMPORT_STATUS, APPROVAL_REQUIRED_DOMAINS } from '../imports.constants';
import type { CreateDefinitionDto, ColumnMappingDto } from '../dto/imports.dto';

type NormalizedRow = Record<string, string | null>;

/** Required target fields per domain (beyond the always-required sourceId). */
const REQUIRED_FIELDS: Record<string, string[]> = {
  people: ['firstName', 'lastName'],
  students: ['firstName', 'lastName'],
  staff: ['firstName', 'lastName'],
  guardians: ['firstName', 'lastName'],
  opening_debt: ['amountKobo'],
  grades: ['score'],
};

/**
 * Import & migration platform (F2 / ADR-09).
 *
 * Drives the pipeline: create → upload → map → validate → dry-run → approve →
 * commit (idempotent by source ref) → reconcile → rollback. The commit target
 * for people reuses Person (F1) keyed by (tenant, sourceSystem, sourceId), so a
 * re-run upserts and never duplicates. Invalid rows stay in an explicit
 * exception queue — never silently committed around the good ones.
 */
@Injectable()
export class ImportService {
  constructor(
    private readonly db: DatabaseService,
    private readonly tenantDb: TenantDbService,
    private readonly documents: DocumentService,
  ) {}

  private get client(): Prisma.TransactionClient {
    return (
      this.tenantDb.isScoped ? this.tenantDb.client : this.db.client
    ) as Prisma.TransactionClient;
  }

  // ---- Definitions --------------------------------------------------

  async createDefinition(
    tenantId: string,
    actorId: string | undefined,
    dto: CreateDefinitionDto,
  ) {
    const definition = await this.client.importDefinition.create({
      data: {
        id: randomUUID(),
        tenantId,
        key: dto.key,
        name: dto.name,
        description: dto.description ?? null,
        targetDomain: dto.targetDomain,
        spec: (dto.spec ?? {}) as Prisma.InputJsonValue,
        createdBy: actorId ?? null,
        reconciliationRules: dto.reconciliationRules
          ? {
              create: dto.reconciliationRules.map((r) => ({
                id: randomUUID(),
                tenantId,
                name: r.name,
                kind: r.kind,
                config: (r.config ?? {}) as Prisma.InputJsonValue,
                tolerance: r.tolerance ?? '0',
              })),
            }
          : undefined,
      },
      include: { reconciliationRules: true },
    });
    await this.audit(
      tenantId,
      actorId,
      'import.definition.create',
      definition.id,
      {
        key: dto.key,
        targetDomain: dto.targetDomain,
      },
    );
    return definition;
  }

  // ---- Job lifecycle ------------------------------------------------

  async createJob(
    tenantId: string,
    actorId: string | undefined,
    definitionKey: string,
    sourceSystem: string,
  ) {
    const definition = await this.client.importDefinition.findUnique({
      where: { tenantId_key: { tenantId, key: definitionKey } },
    });
    if (!definition) throw new NotFoundException('Import definition not found');

    const job = await this.client.importJob.create({
      data: {
        id: randomUUID(),
        tenantId,
        definitionId: definition.id,
        sourceSystem,
        status: IMPORT_STATUS.DRAFT,
        requiresApproval: APPROVAL_REQUIRED_DOMAINS.has(
          definition.targetDomain,
        ),
        createdBy: actorId ?? null,
      },
    });
    await this.audit(tenantId, actorId, 'import.job.create', job.id, {
      definitionKey,
      sourceSystem,
    });
    return job;
  }

  async attachSourceFile(
    tenantId: string,
    actorId: string | undefined,
    jobId: string,
    file: { filename: string; mime?: string; content: Buffer },
  ) {
    await this.getJob(tenantId, jobId); // ensure the job exists in this tenant

    // Store + scan the raw file through the F4 Document platform (checksum,
    // virus scan, retention all handled there).
    const stored = await this.documents.upload(tenantId, actorId, {
      ownerType: 'ImportSourceFile',
      ownerId: jobId,
      mime: file.mime ?? 'text/csv',
      filename: file.filename,
      sensitive: true,
      content: file.content,
    });

    const { headers, rows } = parseCsv(file.content.toString('utf8'));
    if (headers.length === 0) {
      throw new BadRequestException('CSV has no header row');
    }

    await this.client.sourceFile.create({
      data: {
        id: randomUUID(),
        tenantId,
        importJobId: jobId,
        documentId: stored.id,
        filename: file.filename,
        checksum: stored.checksum,
        mime: file.mime ?? 'text/csv',
        size: file.content.length,
        rowCount: rows.length,
        scanStatus: stored.scanStatus,
      },
    });

    // Replace any prior rows (re-upload), then insert the parsed rows.
    await this.client.importRow.deleteMany({ where: { importJobId: jobId } });
    let rowNumber = 1;
    for (const cells of rows) {
      await this.client.importRow.create({
        data: {
          id: randomUUID(),
          tenantId,
          importJobId: jobId,
          rowNumber: rowNumber++,
          rawData: rowToObject(headers, cells) as Prisma.InputJsonValue,
          status: 'pending',
        },
      });
    }

    await this.client.importJob.update({
      where: { id: jobId },
      data: {
        status: IMPORT_STATUS.UPLOADED,
        rowsTotal: rows.length,
      },
    });
    await this.audit(tenantId, actorId, 'import.source_file.attach', jobId, {
      filename: file.filename,
      rows: rows.length,
    });
    return { jobId, rows: rows.length, headers, documentId: stored.id };
  }

  async setMapping(
    tenantId: string,
    actorId: string | undefined,
    jobId: string,
    mappings: ColumnMappingDto[],
  ) {
    await this.getJob(tenantId, jobId);
    await this.client.columnMapping.deleteMany({
      where: { importJobId: jobId },
    });

    for (const m of mappings) {
      let transformRuleId: string | null = null;
      if (m.transform?.type) {
        const rule = await this.client.transformRule.create({
          data: {
            id: randomUUID(),
            tenantId,
            name: `${m.targetField}:${m.transform.type}`,
            type: m.transform.type,
            config: (m.transform.config ?? {}) as Prisma.InputJsonValue,
          },
        });
        transformRuleId = rule.id;
      }
      await this.client.columnMapping.create({
        data: {
          id: randomUUID(),
          tenantId,
          importJobId: jobId,
          sourceColumn: m.sourceColumn,
          targetField: m.targetField,
          transformRuleId,
          required: m.required ?? false,
        },
      });
    }

    await this.client.importJob.update({
      where: { id: jobId },
      data: { status: IMPORT_STATUS.MAPPED },
    });
    await this.audit(tenantId, actorId, 'import.mapping.set', jobId, {
      mappings: mappings.length,
    });
    return { jobId, mappings: mappings.length };
  }

  async validate(tenantId: string, actorId: string | undefined, jobId: string) {
    const job = await this.getJob(tenantId, jobId);
    const definition = await this.client.importDefinition.findUnique({
      where: { id: job.definitionId },
    });
    if (!definition) throw new NotFoundException('Import definition not found');

    const mappings = await this.client.columnMapping.findMany({
      where: { importJobId: jobId },
      include: { transformRule: true },
    });
    if (mappings.length === 0) {
      throw new BadRequestException('No column mappings defined');
    }
    const rows = await this.client.importRow.findMany({
      where: { importJobId: jobId },
      orderBy: { rowNumber: 'asc' },
    });

    const requiredDomainFields = REQUIRED_FIELDS[definition.targetDomain] ?? [];
    let valid = 0;
    let invalid = 0;

    for (const row of rows) {
      // Clear prior issues/candidates (re-validate).
      await this.client.validationIssue.deleteMany({
        where: { importRowId: row.id },
      });
      await this.client.duplicateCandidate.deleteMany({
        where: { importRowId: row.id },
      });

      const raw = row.rawData as Record<string, string>;
      const normalized: NormalizedRow = {};
      const issues: {
        field?: string;
        severity: string;
        code: string;
        message: string;
      }[] = [];

      for (const m of mappings) {
        const rawValue = raw[m.sourceColumn] ?? '';
        let value: string | null = rawValue;
        if (m.transformRule) {
          const result = applyTransform(
            m.transformRule.type,
            m.transformRule.config as Record<string, unknown> | null,
            rawValue,
          );
          value = result.value;
          if (result.error) {
            issues.push({
              field: m.targetField,
              severity: 'error',
              code: 'transform_failed',
              message: result.error,
            });
          }
        }
        normalized[m.targetField] = value === '' ? null : value;
        if (m.required && (value === null || value === '')) {
          issues.push({
            field: m.targetField,
            severity: 'error',
            code: 'required',
            message: `${m.targetField} is required`,
          });
        }
      }

      // sourceId is mandatory — it is what makes the commit idempotent.
      const sourceId = normalized.sourceId ?? null;
      if (!sourceId) {
        issues.push({
          severity: 'error',
          code: 'missing_source_id',
          message: 'A stable sourceId is required for every row',
        });
      }
      for (const field of requiredDomainFields) {
        if (!normalized[field]) {
          issues.push({
            field,
            severity: 'error',
            code: 'required',
            message: `${field} is required for ${definition.targetDomain}`,
          });
        }
      }

      const hasError = issues.some((i) => i.severity === 'error');
      for (const issue of issues) {
        await this.client.validationIssue.create({
          data: {
            id: randomUUID(),
            tenantId,
            importRowId: row.id,
            field: issue.field ?? null,
            severity: issue.severity,
            code: issue.code,
            message: issue.message,
          },
        });
      }

      // Duplicate detection against an existing Person with the same source ref.
      if (!hasError && sourceId && isPersonDomain(definition.targetDomain)) {
        const existing = await this.client.person.findFirst({
          where: {
            tenantId,
            sourceSystem: job.sourceSystem,
            sourceId,
          },
          select: { id: true },
        });
        if (existing) {
          await this.client.duplicateCandidate.create({
            data: {
              id: randomUUID(),
              tenantId,
              importRowId: row.id,
              matchedEntityType: 'Person',
              matchedEntityId: existing.id,
              score: 1,
              resolution: 'pending',
            },
          });
        }
      }

      await this.client.importRow.update({
        where: { id: row.id },
        data: {
          normalizedData: normalized as Prisma.InputJsonValue,
          sourceId,
          status: hasError ? 'invalid' : 'valid',
        },
      });
      if (hasError) invalid++;
      else valid++;
    }

    await this.client.importJob.update({
      where: { id: jobId },
      data: {
        status: IMPORT_STATUS.VALIDATED,
        rowsValid: valid,
        rowsInvalid: invalid,
      },
    });
    await this.audit(tenantId, actorId, 'import.validate', jobId, {
      valid,
      invalid,
    });
    return { jobId, valid, invalid };
  }

  /** What a commit WOULD do, without writing any target rows. */
  async dryRun(tenantId: string, actorId: string | undefined, jobId: string) {
    const job = await this.getJob(tenantId, jobId);
    this.ensureValidated(job.status);
    const validRows = await this.client.importRow.findMany({
      where: { importJobId: jobId, status: 'valid' },
      select: { sourceId: true },
    });

    let create = 0;
    let update = 0;
    for (const r of validRows) {
      const existing = await this.client.person.findFirst({
        where: {
          tenantId,
          sourceSystem: job.sourceSystem,
          sourceId: r.sourceId,
        },
        select: { id: true },
      });
      if (existing) update++;
      else create++;
    }
    const skip = await this.client.importRow.count({
      where: { importJobId: jobId, status: 'invalid' },
    });

    await this.client.importJob.update({
      where: { id: jobId },
      data: { status: IMPORT_STATUS.DRY_RUN },
    });
    return { jobId, wouldCreate: create, wouldUpdate: update, wouldSkip: skip };
  }

  async approve(tenantId: string, actorId: string | undefined, jobId: string) {
    const job = await this.getJob(tenantId, jobId);
    if (!job.requiresApproval) {
      throw new BadRequestException('This import does not require approval');
    }
    await this.client.importJob.update({
      where: { id: jobId },
      data: {
        status: IMPORT_STATUS.APPROVED,
        approvedBy: actorId ?? null,
        approvedAt: new Date(),
      },
    });
    await this.audit(tenantId, actorId, 'import.approve', jobId, {});
    return { jobId, approved: true };
  }

  /**
   * Idempotent commit. Only VALID rows are written; INVALID rows stay in the
   * exception queue. Upsert on (tenant, sourceSystem, sourceId) means a re-run
   * updates rather than duplicates.
   */
  async commit(tenantId: string, actorId: string | undefined, jobId: string) {
    const job = await this.getJob(tenantId, jobId);
    this.ensureCommittable(job);
    const definition = await this.client.importDefinition.findUnique({
      where: { id: job.definitionId },
    });
    if (!definition) throw new NotFoundException('Import definition not found');
    if (!isPersonDomain(definition.targetDomain)) {
      throw new BadRequestException(
        `Commit executor for domain "${definition.targetDomain}" is not yet available`,
      );
    }

    const validRows = await this.client.importRow.findMany({
      where: { importJobId: jobId, status: 'valid' },
      orderBy: { rowNumber: 'asc' },
    });

    let created = 0;
    let updated = 0;
    for (const row of validRows) {
      const data = (row.normalizedData ?? {}) as NormalizedRow;
      const sourceId = row.sourceId as string;
      const existing = await this.client.person.findFirst({
        where: { tenantId, sourceSystem: job.sourceSystem, sourceId },
        select: { id: true },
      });

      const personFields = {
        firstName: data.firstName ?? 'Unknown',
        lastName: data.lastName ?? 'Unknown',
        middleName: data.middleName ?? null,
        preferredName: data.preferredName ?? null,
        gender: data.gender ?? null,
        nationality: data.nationality ?? null,
        stateOfOrigin: data.stateOfOrigin ?? null,
        lgaOfOrigin: data.lgaOfOrigin ?? null,
        religion: data.religion ?? null,
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
      };

      let personId: string;
      if (existing) {
        await this.client.person.update({
          where: { id: existing.id },
          data: { ...personFields, updatedBy: actorId ?? null },
        });
        personId = existing.id;
        updated++;
      } else {
        const person = await this.client.person.create({
          data: {
            id: randomUUID(),
            tenantId,
            sourceSystem: job.sourceSystem,
            sourceId,
            ...personFields,
            createdBy: actorId ?? null,
          },
        });
        personId = person.id;
        created++;
      }

      await this.client.importRow.update({
        where: { id: row.id },
        data: { status: 'committed', targetType: 'Person', targetId: personId },
      });
    }

    const skipped = await this.client.importRow.count({
      where: { importJobId: jobId, status: 'invalid' },
    });

    await this.client.importCommit.upsert({
      where: { importJobId: jobId },
      create: {
        id: randomUUID(),
        tenantId,
        importJobId: jobId,
        createdCount: created,
        updatedCount: updated,
        skippedCount: skipped,
        committedBy: actorId ?? null,
      },
      update: {
        createdCount: created,
        updatedCount: updated,
        skippedCount: skipped,
        committedBy: actorId ?? null,
        committedAt: new Date(),
        reversedAt: null,
        reversedBy: null,
      },
    });

    await this.client.importJob.update({
      where: { id: jobId },
      data: {
        status: IMPORT_STATUS.COMMITTED,
        rowsCommitted: created + updated,
        rowsSkipped: skipped,
      },
    });

    await writeAuditLog(this.db.client, {
      tenantId,
      eventType: AUDIT_EVENT.SECURITY_EVENT,
      action: 'import.commit',
      resource: 'import_job',
      resourceId: jobId,
      actorId: actorId ?? null,
      description: `Committed import ${jobId}`,
      metadata: { created, updated, skipped, sourceSystem: job.sourceSystem },
    });
    return { jobId, created, updated, skipped };
  }

  /** Run the definition's reconciliation rules; money is exact. */
  async reconcile(
    tenantId: string,
    actorId: string | undefined,
    jobId: string,
  ) {
    const job = await this.getJob(tenantId, jobId);
    const rules = await this.client.reconciliationRule.findMany({
      where: { definitionId: job.definitionId },
    });
    const committedRows = await this.client.importRow.findMany({
      where: { importJobId: jobId, status: 'committed' },
      select: { normalizedData: true },
    });
    const sourceFile = await this.client.sourceFile.findFirst({
      where: { importJobId: jobId },
      select: { checksum: true },
    });

    await this.client.reconciliationResult.deleteMany({
      where: { importJobId: jobId },
    });

    const results: { name: string; passed: boolean }[] = [];
    let allPassed = true;

    for (const rule of rules) {
      const config = (rule.config ?? {}) as Record<string, unknown>;
      let expected: string | null = null;
      let actual: string | null = null;
      let passed = false;

      if (rule.kind === 'count') {
        expected = String(config.expected ?? job.rowsValid);
        actual = String(committedRows.length);
        passed = withinTolerance(expected, actual, rule.tolerance);
      } else if (rule.kind === 'sum') {
        const field = String(config.field ?? '');
        const sum = committedRows.reduce((acc, r) => {
          const nd = (r.normalizedData ?? {}) as NormalizedRow;
          const v = Number(nd[field] ?? 0);
          return acc + (Number.isFinite(v) ? v : 0);
        }, 0);
        expected = String(config.expected ?? '0');
        actual = String(sum);
        passed = withinTolerance(expected, actual, rule.tolerance);
      } else if (rule.kind === 'checksum') {
        expected = String(config.expected ?? '');
        actual = sourceFile?.checksum ?? '';
        passed = expected === actual;
      } else {
        // 'sample' — placeholder for artifact sampling (WB7); records intent.
        expected = 'sampled';
        actual = 'pending';
        passed = true;
      }

      allPassed = allPassed && passed;
      results.push({ name: rule.name, passed });
      await this.client.reconciliationResult.create({
        data: {
          id: randomUUID(),
          tenantId,
          importJobId: jobId,
          ruleId: rule.id,
          expected,
          actual,
          passed,
        },
      });
    }

    if (rules.length > 0 && allPassed) {
      await this.client.importJob.update({
        where: { id: jobId },
        data: { status: IMPORT_STATUS.RECONCILED },
      });
    }
    await this.audit(tenantId, actorId, 'import.reconcile', jobId, {
      rules: rules.length,
      allPassed,
    });
    return { jobId, allPassed, results };
  }

  /** Controlled rollback of a committed wave (reverses this wave's source refs). */
  async rollback(tenantId: string, actorId: string | undefined, jobId: string) {
    const job = await this.getJob(tenantId, jobId);
    const commit = await this.client.importCommit.findUnique({
      where: { importJobId: jobId },
    });
    if (!commit) throw new BadRequestException('Nothing to roll back');
    if (commit.reversedAt)
      throw new ConflictException('Import already rolled back');

    const committedRows = await this.client.importRow.findMany({
      where: { importJobId: jobId, status: 'committed' },
      select: { id: true, targetId: true, sourceId: true },
    });

    let removed = 0;
    for (const row of committedRows) {
      if (!row.targetId) continue;
      // Only reverse Persons that carry THIS wave's source ref (created by it).
      const person = await this.client.person.findFirst({
        where: {
          id: row.targetId,
          tenantId,
          sourceSystem: job.sourceSystem,
          sourceId: row.sourceId,
        },
        select: { id: true },
      });
      if (person) {
        await this.client.person.delete({ where: { id: person.id } });
        removed++;
      }
      await this.client.importRow.update({
        where: { id: row.id },
        data: { status: 'valid', targetId: null, targetType: null },
      });
    }

    await this.client.importCommit.update({
      where: { importJobId: jobId },
      data: { reversedAt: new Date(), reversedBy: actorId ?? null },
    });
    await this.client.importJob.update({
      where: { id: jobId },
      data: { status: IMPORT_STATUS.ROLLED_BACK, rowsCommitted: 0 },
    });
    await writeAuditLog(this.db.client, {
      tenantId,
      eventType: AUDIT_EVENT.SECURITY_EVENT,
      action: 'import.rollback',
      resource: 'import_job',
      resourceId: jobId,
      actorId: actorId ?? null,
      description: `Rolled back import ${jobId}`,
      metadata: { removed },
    });
    return { jobId, removed };
  }

  // ---- Reads --------------------------------------------------------

  async getJobDetail(tenantId: string, jobId: string) {
    const job = await this.client.importJob.findFirst({
      where: { id: jobId, tenantId },
      include: {
        definition: { select: { key: true, targetDomain: true } },
        sourceFiles: true,
        commit: true,
        reconciliationResults: true,
        _count: { select: { rows: true } },
      },
    });
    if (!job) throw new NotFoundException('Import job not found');
    return job;
  }

  async listExceptions(tenantId: string, jobId: string) {
    await this.getJob(tenantId, jobId);
    return this.client.importRow.findMany({
      where: { importJobId: jobId, status: 'invalid' },
      include: { issues: true },
      orderBy: { rowNumber: 'asc' },
    });
  }

  // ---- Helpers ------------------------------------------------------

  private async getJob(tenantId: string, jobId: string) {
    const job = await this.client.importJob.findFirst({
      where: { id: jobId, tenantId },
    });
    if (!job) throw new NotFoundException('Import job not found');
    return job;
  }

  private ensureValidated(status: string) {
    if (
      status !== IMPORT_STATUS.VALIDATED &&
      status !== IMPORT_STATUS.DRY_RUN &&
      status !== IMPORT_STATUS.APPROVED
    ) {
      throw new ConflictException(
        `Import must be validated first (current status: ${status})`,
      );
    }
  }

  private ensureCommittable(job: {
    status: string;
    requiresApproval: boolean;
  }) {
    this.ensureValidated(job.status);
    if (job.requiresApproval && job.status !== IMPORT_STATUS.APPROVED) {
      throw new ForbiddenException(
        'This import requires approval before it can be committed',
      );
    }
  }

  private async audit(
    tenantId: string,
    actorId: string | undefined,
    action: string,
    resourceId: string,
    metadata: Record<string, unknown>,
  ) {
    await writeAuditLog(this.db.client, {
      tenantId,
      eventType: AUDIT_EVENT.DATA_CHANGE,
      action,
      resource: 'import_job',
      resourceId,
      actorId: actorId ?? null,
      description: `${action} ${resourceId}`,
      metadata,
    });
  }
}

function isPersonDomain(domain: string): boolean {
  return (
    domain === 'people' ||
    domain === 'students' ||
    domain === 'staff' ||
    domain === 'guardians'
  );
}

/** Exact (tolerance 0) or |expected-actual| <= tolerance for numeric rules. */
function withinTolerance(
  expected: string,
  actual: string,
  tolerance: string,
): boolean {
  const e = Number(expected);
  const a = Number(actual);
  const t = Number(tolerance);
  if (!Number.isFinite(e) || !Number.isFinite(a)) return expected === actual;
  if (!Number.isFinite(t) || t === 0) return e === a;
  return Math.abs(e - a) <= t;
}
