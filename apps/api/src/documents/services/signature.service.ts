import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@workspace/database';
import { DatabaseService } from '../../common/database/database.service';
import { TenantDbService } from '../../common/database/tenant-db.service';
import { writeAuditLog } from '../../common/audit/audit-writer';
import { AUDIT_EVENT } from '../../common/audit/audit.constants';

export interface RegisterSigningAuthorityInput {
  personId: string;
  role: string;
  signatureDocumentId?: string;
  validFrom?: string;
  validTo?: string;
}

export interface ApplySignatureInput {
  signingAuthorityId: string;
  artifactType: string;
  artifactId: string;
  producedDocumentId?: string;
  artifactChecksum?: string;
  reason?: string;
}

/**
 * Signature-asset governance (F4 / ADR-08).
 *
 * A signature is a governed asset, not a browsable image. A person's authority
 * to sign in a role is a validity-dated `SigningAuthority`; a signature is only
 * ever applied to a specific artifact through a `SignatureUse`, authorized per
 * use and audited. There is no way to "fetch the signature and paste it" — the
 * image itself is a restricted Document, never listed.
 */
@Injectable()
export class SignatureService {
  constructor(
    private readonly db: DatabaseService,
    private readonly tenantDb: TenantDbService,
  ) {}

  private get client(): Prisma.TransactionClient {
    return (
      this.tenantDb.isScoped ? this.tenantDb.client : this.db.client
    ) as Prisma.TransactionClient;
  }

  async registerAuthority(
    tenantId: string,
    actorId: string | undefined,
    input: RegisterSigningAuthorityInput,
  ) {
    const authority = await this.client.signingAuthority.upsert({
      where: {
        tenantId_personId_role: {
          tenantId,
          personId: input.personId,
          role: input.role,
        },
      },
      create: {
        id: randomUUID(),
        tenantId,
        personId: input.personId,
        role: input.role,
        signatureDocumentId: input.signatureDocumentId ?? null,
        validFrom: input.validFrom ? new Date(input.validFrom) : new Date(),
        validTo: input.validTo ? new Date(input.validTo) : null,
        status: 'active',
        createdBy: actorId ?? null,
      },
      update: {
        signatureDocumentId: input.signatureDocumentId ?? undefined,
        validTo: input.validTo ? new Date(input.validTo) : undefined,
        status: 'active',
      },
    });
    await this.audit(tenantId, actorId, 'signing_authority.register', authority.id, {
      personId: input.personId,
      role: input.role,
    });
    return authority;
  }

  async revokeAuthority(
    tenantId: string,
    actorId: string | undefined,
    id: string,
  ) {
    const authority = await this.client.signingAuthority.findFirst({
      where: { id, tenantId },
    });
    if (!authority) throw new NotFoundException('Signing authority not found');
    await this.client.signingAuthority.update({
      where: { id },
      data: { status: 'revoked', validTo: new Date() },
    });
    await this.audit(tenantId, actorId, 'signing_authority.revoke', id, {});
    return { id, status: 'revoked' };
  }

  /**
   * Apply a signature to a specific artifact — the ONLY way a signature is ever
   * used. Refuses unless an active, in-validity SigningAuthority exists.
   */
  async applySignature(
    tenantId: string,
    actorId: string | undefined,
    input: ApplySignatureInput,
  ) {
    const authority = await this.client.signingAuthority.findFirst({
      where: { id: input.signingAuthorityId, tenantId },
    });
    if (!authority) throw new NotFoundException('Signing authority not found');

    const now = new Date();
    const active =
      authority.status === 'active' &&
      authority.validFrom <= now &&
      (authority.validTo === null || authority.validTo >= now);
    if (!active) {
      throw new ForbiddenException(
        'Signing authority is not active or has expired',
      );
    }

    const use = await this.client.signatureUse.create({
      data: {
        id: randomUUID(),
        tenantId,
        signingAuthorityId: authority.id,
        artifactType: input.artifactType,
        artifactId: input.artifactId,
        producedDocumentId: input.producedDocumentId ?? null,
        artifactChecksum: input.artifactChecksum ?? null,
        reason: input.reason ?? null,
        status: 'applied',
        appliedBy: actorId ?? null,
      },
    });

    await writeAuditLog(this.db.client, {
      tenantId,
      eventType: AUDIT_EVENT.SECURITY_EVENT,
      action: 'signature.apply',
      resource: 'signature_use',
      resourceId: use.id,
      actorId: actorId ?? null,
      description: `Applied signature (${authority.role}) to ${input.artifactType} ${input.artifactId}`,
      metadata: {
        signingAuthorityId: authority.id,
        role: authority.role,
        artifactType: input.artifactType,
        artifactId: input.artifactId,
      },
    });
    return use;
  }

  async listUses(tenantId: string, artifactType: string, artifactId: string) {
    return this.client.signatureUse.findMany({
      where: { tenantId, artifactType, artifactId },
      include: {
        signingAuthority: { select: { role: true, personId: true, status: true } },
      },
      orderBy: { appliedAt: 'desc' },
    });
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
      eventType: AUDIT_EVENT.SECURITY_EVENT,
      action,
      resource: 'signing_authority',
      resourceId,
      actorId: actorId ?? null,
      description: `${action} ${resourceId}`,
      metadata,
    });
  }
}
