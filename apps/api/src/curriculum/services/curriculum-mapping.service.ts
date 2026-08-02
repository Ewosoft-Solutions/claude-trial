import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@workspace/database';

import { TenantDbService } from '../../common/database/tenant-db.service';
import { AuditService } from '../../common/audit/audit.service';
import { AUDIT_EVENT } from '../../common/audit/audit.constants';
import { normalizeName } from '../curriculum.util';

export interface UpsertMappingInput {
  fromName: string;
  toSubjectId?: string;
  toCanonicalName?: string;
  kind?: string;
  note?: string;
}

/**
 * Subject-name aliases (F6 / ADR-03): resolve a legacy/dirty name to a canonical
 * subject, so "Cultural And Creative Arts" ↔ "Cultural & Creative Arts" de-dup
 * on transfer + migration. Keyed on the normalized name (tenant-scoped).
 */
@Injectable()
export class CurriculumMappingService {
  constructor(
    private readonly tenantDb: TenantDbService,
    private readonly audit: AuditService,
  ) {}

  private get client(): Prisma.TransactionClient {
    return this.tenantDb.client;
  }

  async upsert(
    tenantId: string,
    actorId: string | undefined,
    input: UpsertMappingInput,
  ) {
    const fromNormalized = normalizeName(input.fromName);
    const mapping = await this.client.curriculumMapping.upsert({
      where: { tenantId_fromNormalized: { tenantId, fromNormalized } },
      create: {
        id: randomUUID(),
        tenantId,
        fromName: input.fromName,
        fromNormalized,
        toSubjectId: input.toSubjectId ?? null,
        toCanonicalName: input.toCanonicalName ?? null,
        kind: input.kind ?? 'alias',
        note: input.note ?? null,
        createdBy: actorId ?? null,
      },
      update: {
        fromName: input.fromName,
        toSubjectId: input.toSubjectId ?? undefined,
        toCanonicalName: input.toCanonicalName ?? undefined,
        kind: input.kind ?? undefined,
        note: input.note ?? undefined,
      },
    });
    await this.audit.write({
      tenantId,
      eventType: AUDIT_EVENT.DATA_CHANGE,
      action: 'curriculum.mapping.upsert',
      resource: 'curriculum_mapping',
      resourceId: mapping.id,
      actorId: actorId ?? null,
      description: `alias ${input.fromName}`,
      metadata: { fromNormalized },
    });
    return mapping;
  }

  /** Resolve a (possibly dirty) subject name to its canonical mapping, or null. */
  async resolve(tenantId: string, name: string) {
    const fromNormalized = normalizeName(name);
    return this.client.curriculumMapping.findFirst({
      where: { tenantId, fromNormalized },
    });
  }

  list(tenantId: string) {
    return this.client.curriculumMapping.findMany({
      where: { tenantId },
      orderBy: { fromName: 'asc' },
    });
  }
}
