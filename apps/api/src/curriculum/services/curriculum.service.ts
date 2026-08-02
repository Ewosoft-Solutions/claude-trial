import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@workspace/database';

import { TenantDbService } from '../../common/database/tenant-db.service';
import { AuditService } from '../../common/audit/audit.service';
import { AUDIT_EVENT } from '../../common/audit/audit.constants';
import { normalizeName } from '../curriculum.util';

/**
 * Curriculum authoring (F6 / ADR-03). A tenant builds its OWN curriculum tree
 * (authority → framework → version → stage → subject → node → outcome), all
 * tenant-owned. NATIONAL content (tenant_id NULL) is platform-seeded and
 * IMMUTABLE to tenants: authoring is refused on any version the caller does not
 * own — a tenant customizes national content via a TenantCurriculumOverlay, not
 * by mutating the source. Activation is gated (an academic owner) and refuses to
 * publish a version with unreviewed AI/imported nodes (provenance gate, C081).
 */
@Injectable()
export class CurriculumService {
  constructor(
    private readonly tenantDb: TenantDbService,
    private readonly audit: AuditService,
  ) {}

  private get client(): Prisma.TransactionClient {
    return this.tenantDb.client;
  }

  // ---- authoring (tenant-owned) ----

  async createAuthority(
    tenantId: string,
    actorId: string | undefined,
    input: {
      name: string;
      code: string;
      kind?: string;
      country?: string;
      description?: string;
    },
  ) {
    const authority = await this.client.curriculumAuthority.create({
      data: {
        id: randomUUID(),
        tenantId,
        name: input.name,
        code: input.code,
        kind: input.kind ?? 'tenant',
        country: input.country ?? null,
        description: input.description ?? null,
        createdBy: actorId ?? null,
      },
    });
    await this.write(
      tenantId,
      actorId,
      'curriculum.authority.create',
      authority.id,
      {
        code: input.code,
      },
    );
    return authority;
  }

  async createFramework(
    tenantId: string,
    actorId: string | undefined,
    input: {
      authorityId: string;
      name: string;
      code: string;
      subjectArea?: string;
      description?: string;
    },
  ) {
    const authority = await this.client.curriculumAuthority.findFirst({
      where: { id: input.authorityId },
      select: { id: true },
    });
    if (!authority) throw new NotFoundException('Authority not found');
    const framework = await this.client.curriculumFramework.create({
      data: {
        id: randomUUID(),
        tenantId,
        authorityId: input.authorityId,
        name: input.name,
        code: input.code,
        subjectArea: input.subjectArea ?? null,
        description: input.description ?? null,
        createdBy: actorId ?? null,
      },
    });
    await this.write(
      tenantId,
      actorId,
      'curriculum.framework.create',
      framework.id,
      {},
    );
    return framework;
  }

  async createVersion(
    tenantId: string,
    actorId: string | undefined,
    input: {
      frameworkId: string;
      versionLabel: string;
      effectiveFrom: string | Date;
      effectiveTo?: string | Date | null;
      provenance?: Record<string, unknown>;
    },
  ) {
    const framework = await this.client.curriculumFramework.findFirst({
      where: { id: input.frameworkId },
      select: { id: true, tenantId: true },
    });
    if (!framework) throw new NotFoundException('Framework not found');
    if (framework.tenantId !== tenantId) {
      throw new ForbiddenException(
        'Cannot version a national/other-tenant framework — adopt it or create your own.',
      );
    }
    const version = await this.client.curriculumVersion.create({
      data: {
        id: randomUUID(),
        tenantId,
        frameworkId: input.frameworkId,
        versionLabel: input.versionLabel,
        effectiveFrom: new Date(input.effectiveFrom),
        effectiveTo: input.effectiveTo ? new Date(input.effectiveTo) : null,
        approvalState: 'draft',
        provenance: (input.provenance ?? undefined) as
          | Prisma.InputJsonValue
          | undefined,
        createdBy: actorId ?? null,
      },
    });
    await this.write(
      tenantId,
      actorId,
      'curriculum.version.create',
      version.id,
      {
        versionLabel: input.versionLabel,
      },
    );
    return version;
  }

  async addStage(
    tenantId: string,
    actorId: string | undefined,
    versionId: string,
    input: { name: string; levelCode?: string; order?: number },
  ) {
    await this.assertWritableVersion(tenantId, versionId);
    return this.client.curriculumStage.create({
      data: {
        id: randomUUID(),
        tenantId,
        versionId,
        name: input.name,
        levelCode: input.levelCode ?? null,
        order: input.order ?? 0,
      },
    });
  }

  async addSubject(
    tenantId: string,
    actorId: string | undefined,
    versionId: string,
    input: {
      code: string;
      name: string;
      stageId?: string;
      canonicalName?: string;
      order?: number;
    },
  ) {
    await this.assertWritableVersion(tenantId, versionId);
    return this.client.curriculumSubject.create({
      data: {
        id: randomUUID(),
        tenantId,
        versionId,
        stageId: input.stageId ?? null,
        code: input.code,
        name: input.name,
        canonicalName: input.canonicalName ?? normalizeName(input.name),
        order: input.order ?? 0,
      },
    });
  }

  async addNode(
    tenantId: string,
    actorId: string | undefined,
    subjectId: string,
    input: {
      title: string;
      kind?: string;
      parentId?: string;
      code?: string;
      order?: number;
      origin?: string;
      provenance?: Record<string, unknown>;
      reviewedBy?: string;
    },
  ) {
    const subject = await this.client.curriculumSubject.findFirst({
      where: { id: subjectId },
      select: { id: true, versionId: true, tenantId: true },
    });
    if (!subject) throw new NotFoundException('Subject not found');
    await this.assertWritableVersion(tenantId, subject.versionId);
    const origin = input.origin ?? 'authored';
    return this.client.curriculumNode.create({
      data: {
        id: randomUUID(),
        tenantId,
        versionId: subject.versionId,
        subjectId,
        parentId: input.parentId ?? null,
        kind: input.kind ?? 'topic',
        title: input.title,
        code: input.code ?? null,
        order: input.order ?? 0,
        origin,
        // An AI/imported node is unreviewed unless a reviewer is supplied.
        reviewedBy: input.reviewedBy ?? null,
        reviewedAt: input.reviewedBy ? new Date() : null,
        provenance: (input.provenance ?? undefined) as
          | Prisma.InputJsonValue
          | undefined,
        createdBy: actorId ?? null,
      },
    });
  }

  async addOutcome(
    tenantId: string,
    actorId: string | undefined,
    nodeId: string,
    input: { statement: string; code?: string; order?: number },
  ) {
    const node = await this.client.curriculumNode.findFirst({
      where: { id: nodeId },
      select: { id: true, versionId: true },
    });
    if (!node) throw new NotFoundException('Node not found');
    await this.assertWritableVersion(tenantId, node.versionId);
    return this.client.learningOutcome.create({
      data: {
        id: randomUUID(),
        tenantId,
        nodeId,
        code: input.code ?? null,
        statement: input.statement,
        order: input.order ?? 0,
      },
    });
  }

  /** Record a human review of an AI/imported node (unblocks activation). */
  async reviewNode(
    tenantId: string,
    actorId: string | undefined,
    nodeId: string,
  ) {
    const node = await this.client.curriculumNode.findFirst({
      where: { id: nodeId },
      select: { id: true, versionId: true },
    });
    if (!node) throw new NotFoundException('Node not found');
    await this.assertWritableVersion(tenantId, node.versionId);
    const updated = await this.client.curriculumNode.update({
      where: { id: nodeId },
      data: { reviewedBy: actorId ?? 'reviewer', reviewedAt: new Date() },
    });
    await this.write(tenantId, actorId, 'curriculum.node.review', nodeId, {});
    return updated;
  }

  // ---- lifecycle ----

  /**
   * Approve/activate a version. Requires the version to be tenant-owned and all
   * AI/imported nodes to have a named reviewer — nothing AI-generated becomes
   * teaching content without a human approver (ADR-03 / C081).
   */
  async activateVersion(
    tenantId: string,
    actorId: string | undefined,
    versionId: string,
  ) {
    const version = await this.assertWritableVersion(tenantId, versionId);
    const unreviewed = await this.client.curriculumNode.count({
      where: {
        versionId,
        origin: { in: ['ai', 'imported'] },
        reviewedBy: null,
      },
    });
    if (unreviewed > 0) {
      throw new ForbiddenException(
        `Cannot activate: ${unreviewed} AI/imported node(s) lack a named reviewer.`,
      );
    }
    const updated = await this.client.curriculumVersion.update({
      where: { id: versionId },
      data: {
        approvalState: 'active',
        approvedBy: actorId ?? null,
        approvedAt: new Date(),
        publishedAt: version.publishedAt ?? new Date(),
      },
    });
    await this.write(
      tenantId,
      actorId,
      'curriculum.version.activate',
      versionId,
      {
        versionLabel: version.versionLabel,
      },
    );
    return updated;
  }

  // ---- reads ----

  listVersions(tenantId: string, frameworkId?: string) {
    // RLS returns the tenant's own versions PLUS shared national (tenant_id NULL).
    return this.client.curriculumVersion.findMany({
      where: { ...(frameworkId ? { frameworkId } : {}) },
      orderBy: [{ effectiveFrom: 'desc' }],
    });
  }

  async getVersionTree(versionId: string) {
    const version = await this.client.curriculumVersion.findFirst({
      where: { id: versionId },
    });
    if (!version) throw new NotFoundException('Version not found');
    const subjects = await this.client.curriculumSubject.findMany({
      where: { versionId },
      orderBy: { order: 'asc' },
      include: {
        nodes: {
          orderBy: { order: 'asc' },
          include: { outcomes: { orderBy: { order: 'asc' } } },
        },
      },
    });
    return { version, subjects };
  }

  /**
   * Load a version and assert the caller may WRITE it — i.e. the caller owns it.
   * National (tenant_id NULL) or another tenant's version is immutable here.
   */
  private async assertWritableVersion(tenantId: string, versionId: string) {
    const version = await this.client.curriculumVersion.findFirst({
      where: { id: versionId },
    });
    if (!version) throw new NotFoundException('Version not found');
    if (version.tenantId !== tenantId) {
      throw new ForbiddenException(
        'This curriculum version is national/immutable — customize it with an overlay instead.',
      );
    }
    return version;
  }

  private write(
    tenantId: string,
    actorId: string | undefined,
    action: string,
    resourceId: string,
    metadata: Record<string, unknown>,
  ) {
    return this.audit.write({
      tenantId,
      eventType: AUDIT_EVENT.DATA_CHANGE,
      action,
      resource: 'curriculum',
      resourceId,
      actorId: actorId ?? null,
      description: action,
      metadata,
    });
  }
}
