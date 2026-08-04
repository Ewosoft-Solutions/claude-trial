import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@workspace/database';

import { TenantDbService } from '../../common/database/tenant-db.service';
import { AuditService } from '../../common/audit/audit.service';
import { AUDIT_EVENT } from '../../common/audit/audit.constants';
import type {
  ConsentCategory,
  CreateGuardianshipDto,
  UpdateGuardianshipDto,
} from '../dto/guardianship.dto';

/** A resolved comms recipient for a ward, by relationship + consent. */
export interface GuardianAudienceMember {
  relationshipId: string;
  guardianPersonId: string;
  guardianName: string;
  relationship: string;
  isPrimary: boolean;
  contactPriority: number | null;
  isEmergencyContact: boolean;
}

const GUARDIAN_INCLUDE = {
  guardian: {
    select: { id: true, firstName: true, lastName: true, preferredName: true },
  },
  ward: {
    select: { id: true, firstName: true, lastName: true, preferredName: true },
  },
} satisfies Prisma.GuardianRelationshipInclude;

type GuardianRow = Prisma.GuardianRelationshipGetPayload<{
  include: typeof GUARDIAN_INCLUDE;
}>;

/** Which consent flag a comms category maps to. `emergency` is not consent-gated. */
const CATEGORY_CONSENT: Record<
  Exclude<ConsentCategory, 'emergency'>,
  keyof Pick<
    Prisma.GuardianRelationshipUncheckedCreateInput,
    'consentResults' | 'consentFinance' | 'consentAttendance' | 'consentGeneral'
  >
> = {
  results: 'consentResults',
  finance: 'consentFinance',
  attendance: 'consentAttendance',
  general: 'consentGeneral',
};

/**
 * Guardianship authority / priority / consent (WB1-4).
 *
 * The go-forward caregiver model over F1's `GuardianRelationship` (Person→Person)
 * — a school can record multiple non-parent caregivers with distinct authority
 * (custody, pickup, medical, emergency, billing) and per-category contact
 * consent, and verify the claim. `resolveAudience` is the payoff: results/fee
 * comms target guardians **by relationship + consent**, never a gender label
 * (C049). All reads/writes go through the RLS-scoped client (tenant isolation is
 * enforced by the DB, not a WHERE clause).
 */
@Injectable()
export class GuardianshipService {
  constructor(
    private readonly tenantDb: TenantDbService,
    private readonly auditService: AuditService,
  ) {}

  private get client(): Prisma.TransactionClient {
    return this.tenantDb.client;
  }

  private project(row: GuardianRow) {
    const name = (p: {
      firstName: string;
      lastName: string;
      preferredName: string | null;
    }) => (p.preferredName || `${p.firstName} ${p.lastName}`).trim();
    return {
      id: row.id,
      guardianPersonId: row.guardianPersonId,
      guardianName: name(row.guardian),
      wardPersonId: row.wardPersonId,
      wardName: name(row.ward),
      relationship: row.relationship,
      isPrimary: row.isPrimary,
      legalGuardian: row.legalGuardian,
      contactPriority: row.contactPriority,
      custodyType: row.custodyType,
      canPickup: row.canPickup,
      canAuthorizeMedical: row.canAuthorizeMedical,
      isEmergencyContact: row.isEmergencyContact,
      isBillingContact: row.isBillingContact,
      consent: {
        results: row.consentResults,
        finance: row.consentFinance,
        attendance: row.consentAttendance,
        general: row.consentGeneral,
      },
      verified: row.verifiedAt != null,
      verifiedAt: row.verifiedAt,
      verificationMethod: row.verificationMethod,
      effectiveFrom: row.effectiveFrom,
      effectiveTo: row.effectiveTo,
      endedReason: row.endedReason,
    };
  }

  private async ensureActivePerson(tenantId: string, personId: string) {
    const person = await this.client.person.findFirst({
      where: { id: personId, tenantId },
      select: { id: true, status: true },
    });
    if (!person) throw new NotFoundException('Person not found');
    if (person.status !== 'active') {
      throw new ConflictException(`Person is ${person.status}, not active`);
    }
  }

  private async recordHistory(
    tenantId: string,
    personId: string,
    changeType: string,
    summary: string,
    actorId: string | undefined,
    detail?: Record<string, unknown>,
  ) {
    await this.client.relationshipHistory.create({
      data: {
        id: randomUUID(),
        tenantId,
        personId,
        changeType,
        summary,
        detail: (detail ?? undefined) as Prisma.InputJsonValue | undefined,
        recordedBy: actorId ?? null,
      },
    });
  }

  private async audit(
    tenantId: string,
    actorId: string | undefined,
    action: string,
    resourceId: string,
    metadata: Record<string, unknown>,
  ) {
    await this.auditService.write({
      tenantId,
      eventType: AUDIT_EVENT.DATA_CHANGE,
      action,
      resource: 'guardian_relationship',
      resourceId,
      actorId: actorId ?? null,
      description: `${action} ${resourceId}`,
      metadata,
    });
  }

  private async load(tenantId: string, id: string): Promise<GuardianRow> {
    const row = await this.client.guardianRelationship.findFirst({
      where: { id, tenantId },
      include: GUARDIAN_INCLUDE,
    });
    if (!row) throw new NotFoundException('Guardian relationship not found');
    return row;
  }

  async create(
    tenantId: string,
    actorId: string | undefined,
    dto: CreateGuardianshipDto,
  ) {
    if (dto.guardianPersonId === dto.wardPersonId) {
      throw new BadRequestException('A person cannot be their own guardian');
    }
    await this.ensureActivePerson(tenantId, dto.guardianPersonId);
    await this.ensureActivePerson(tenantId, dto.wardPersonId);

    try {
      const created = await this.client.guardianRelationship.create({
        data: {
          id: randomUUID(),
          tenantId,
          guardianPersonId: dto.guardianPersonId,
          wardPersonId: dto.wardPersonId,
          relationship: dto.relationship ?? 'parent',
          isPrimary: dto.isPrimary ?? false,
          legalGuardian: dto.legalGuardian ?? false,
          custodyType: dto.custodyType ?? null,
          canPickup: dto.canPickup ?? false,
          canAuthorizeMedical: dto.canAuthorizeMedical ?? false,
          isEmergencyContact: dto.isEmergencyContact ?? false,
          isBillingContact: dto.isBillingContact ?? false,
          // A caregiver is opted-in to operational categories by default; an
          // explicit false opts out. Emergency reach is authority, not consent.
          consentResults: dto.consentResults ?? true,
          consentFinance: dto.consentFinance ?? true,
          consentAttendance: dto.consentAttendance ?? true,
          consentGeneral: dto.consentGeneral ?? true,
          createdBy: actorId ?? null,
        },
        include: GUARDIAN_INCLUDE,
      });
      // At most one primary contact per ward: promoting this one demotes any
      // other current primary (the "the old #1 steps down" rule).
      if (created.isPrimary) {
        await this.demoteOtherPrimaries(tenantId, dto.wardPersonId, created.id);
      }
      await this.recordHistory(
        tenantId,
        dto.guardianPersonId,
        'relationship_added',
        `Became guardian (${created.relationship})`,
        actorId,
        { wardPersonId: dto.wardPersonId },
      );
      await this.recordHistory(
        tenantId,
        dto.wardPersonId,
        'relationship_added',
        `Guardian assigned (${created.relationship})`,
        actorId,
        { guardianPersonId: dto.guardianPersonId },
      );
      await this.audit(tenantId, actorId, 'guardianship.create', created.id, {
        guardianPersonId: dto.guardianPersonId,
        wardPersonId: dto.wardPersonId,
        relationship: created.relationship,
      });
      return this.project(created);
    } catch (e) {
      if (isUniqueViolation(e)) {
        throw new ConflictException(
          'This guardian is already linked to this ward',
        );
      }
      throw e;
    }
  }

  async update(
    tenantId: string,
    actorId: string | undefined,
    id: string,
    dto: UpdateGuardianshipDto,
  ) {
    const before = await this.load(tenantId, id);
    if (before.effectiveTo) {
      throw new ConflictException('Cannot edit an ended relationship');
    }
    const data: Prisma.GuardianRelationshipUpdateInput = {};
    if (dto.relationship !== undefined) data.relationship = dto.relationship;
    if (dto.isPrimary !== undefined) data.isPrimary = dto.isPrimary;
    if (dto.legalGuardian !== undefined) data.legalGuardian = dto.legalGuardian;
    if (dto.custodyType !== undefined) data.custodyType = dto.custodyType;
    if (dto.canPickup !== undefined) data.canPickup = dto.canPickup;
    if (dto.canAuthorizeMedical !== undefined) {
      data.canAuthorizeMedical = dto.canAuthorizeMedical;
    }
    if (dto.isEmergencyContact !== undefined) {
      data.isEmergencyContact = dto.isEmergencyContact;
    }
    if (dto.isBillingContact !== undefined) {
      data.isBillingContact = dto.isBillingContact;
    }
    if (dto.consentResults !== undefined) {
      data.consentResults = dto.consentResults;
    }
    if (dto.consentFinance !== undefined) {
      data.consentFinance = dto.consentFinance;
    }
    if (dto.consentAttendance !== undefined) {
      data.consentAttendance = dto.consentAttendance;
    }
    if (dto.consentGeneral !== undefined) {
      data.consentGeneral = dto.consentGeneral;
    }

    const updated = await this.client.guardianRelationship.update({
      where: { id },
      data,
      include: GUARDIAN_INCLUDE,
    });
    // Promoting this relationship to primary demotes any other current primary
    // for the same ward (exactly one primary contact).
    if (dto.isPrimary === true) {
      await this.demoteOtherPrimaries(tenantId, before.wardPersonId, id);
    }
    await this.audit(tenantId, actorId, 'guardianship.update', id, {
      changed: Object.keys(data),
    });
    return this.project(updated);
  }

  /** Clear `isPrimary` on every OTHER active guardianship of this ward. */
  private async demoteOtherPrimaries(
    tenantId: string,
    wardPersonId: string,
    keepId: string,
  ) {
    await this.client.guardianRelationship.updateMany({
      where: {
        tenantId,
        wardPersonId,
        id: { not: keepId },
        effectiveTo: null,
        isPrimary: true,
      },
      data: { isPrimary: false },
    });
  }

  async verify(
    tenantId: string,
    actorId: string | undefined,
    id: string,
    method: string,
  ) {
    await this.load(tenantId, id);
    const updated = await this.client.guardianRelationship.update({
      where: { id },
      data: {
        verifiedAt: new Date(),
        verifiedBy: actorId ?? null,
        verificationMethod: method,
      },
      include: GUARDIAN_INCLUDE,
    });
    await this.audit(tenantId, actorId, 'guardianship.verify', id, { method });
    return this.project(updated);
  }

  /** End a relationship (effective-dated, not deleted — history is preserved). */
  async end(
    tenantId: string,
    actorId: string | undefined,
    id: string,
    reason?: string,
  ) {
    const before = await this.load(tenantId, id);
    if (before.effectiveTo) {
      throw new ConflictException('Relationship already ended');
    }
    const updated = await this.client.guardianRelationship.update({
      where: { id },
      data: { effectiveTo: new Date(), endedReason: reason ?? null },
      include: GUARDIAN_INCLUDE,
    });
    await this.recordHistory(
      tenantId,
      before.guardianPersonId,
      'relationship_ended',
      'Guardian relationship ended',
      actorId,
      { wardPersonId: before.wardPersonId, reason: reason ?? null },
    );
    await this.recordHistory(
      tenantId,
      before.wardPersonId,
      'relationship_ended',
      'Guardian relationship ended',
      actorId,
      { guardianPersonId: before.guardianPersonId, reason: reason ?? null },
    );
    await this.audit(tenantId, actorId, 'guardianship.end', id, {
      reason: reason ?? null,
    });
    return this.project(updated);
  }

  async list(
    tenantId: string,
    filter: {
      wardPersonId?: string;
      guardianPersonId?: string;
      includeEnded?: boolean;
    },
  ) {
    if (!filter.wardPersonId && !filter.guardianPersonId) {
      throw new BadRequestException(
        'Provide wardPersonId or guardianPersonId to list guardianships',
      );
    }
    const where: Prisma.GuardianRelationshipWhereInput = { tenantId };
    if (filter.wardPersonId) where.wardPersonId = filter.wardPersonId;
    if (filter.guardianPersonId) {
      where.guardianPersonId = filter.guardianPersonId;
    }
    if (!filter.includeEnded) where.effectiveTo = null;

    const rows = await this.client.guardianRelationship.findMany({
      where,
      include: GUARDIAN_INCLUDE,
      orderBy: [
        { isPrimary: 'desc' },
        { contactPriority: 'asc' },
        { createdAt: 'asc' },
      ],
    });
    return rows.map((r) => this.project(r));
  }

  /**
   * Resolve who to notify for a ward, **by relationship + consent** (WB1-4
   * acceptance). For `emergency`, every emergency-contact guardian is returned
   * regardless of the per-category consent flags (a `critical` send overrides
   * opt-out); for every other category only guardians who consent to it are
   * returned. Ordered primary-first, then by contact priority — this is the
   * recipient list results/fee comms fan out over, never a gender label.
   */
  async resolveAudience(
    tenantId: string,
    wardPersonId: string,
    category: ConsentCategory,
  ): Promise<GuardianAudienceMember[]> {
    const where: Prisma.GuardianRelationshipWhereInput = {
      tenantId,
      wardPersonId,
      effectiveTo: null,
    };
    if (category === 'emergency') {
      where.isEmergencyContact = true;
    } else {
      where[CATEGORY_CONSENT[category]] = true;
    }

    const rows = await this.client.guardianRelationship.findMany({
      where,
      include: GUARDIAN_INCLUDE,
      orderBy: [
        { isPrimary: 'desc' },
        { contactPriority: 'asc' },
        { createdAt: 'asc' },
      ],
    });
    return rows.map((r) => ({
      relationshipId: r.id,
      guardianPersonId: r.guardianPersonId,
      guardianName: (
        r.guardian.preferredName ||
        `${r.guardian.firstName} ${r.guardian.lastName}`
      ).trim(),
      relationship: r.relationship,
      isPrimary: r.isPrimary,
      contactPriority: r.contactPriority,
      isEmergencyContact: r.isEmergencyContact,
    }));
  }
}

function isUniqueViolation(e: unknown): boolean {
  return (
    e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002'
  );
}
