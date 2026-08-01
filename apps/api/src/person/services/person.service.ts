import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes, randomUUID } from 'node:crypto';
import { Prisma } from '@workspace/database';
import { TenantDbService } from '../../common/database/tenant-db.service';
import { AuditService } from '../../common/audit/audit.service';
import { AUDIT_EVENT } from '../../common/audit/audit.constants';
import { maskContactValue, normalizeContact } from '../person.masking';
import type {
  CreatePersonDto,
  UpdatePersonDto,
  SearchPeopleDto,
  AddContactPointDto,
  AddStaffProfileDto,
  AddGuardianshipDto,
} from '../dto/person.dto';

/** The relations loaded for a person detail view. */
const PERSON_DETAIL_INCLUDE = {
  contactPoints: { orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] },
  addresses: { orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] },
  staffProfiles: { orderBy: { createdAt: 'desc' } },
  studentProfile: {
    select: { id: true, studentNumber: true, enrollmentStatus: true },
  },
  guardianships: {
    where: { effectiveTo: null },
    include: {
      ward: { select: { id: true, firstName: true, lastName: true } },
    },
  },
  wardLinks: {
    where: { effectiveTo: null },
    include: {
      guardian: { select: { id: true, firstName: true, lastName: true } },
    },
  },
} satisfies Prisma.PersonInclude;

type PersonDetail = Prisma.PersonGetPayload<{
  include: typeof PERSON_DETAIL_INCLUDE;
}>;

/**
 * Person foundation (F1 / ADR-01).
 *
 * One human = one tenant-scoped `Person` with linked profiles (staff, student,
 * guardian) and contacts. All reads/writes go through the RLS-scoped client, so
 * a Person in tenant A is invisible to tenant B (enforced by the DB, not by a
 * WHERE clause we could forget). Merge/dedup lives in PersonMergeService.
 */
@Injectable()
export class PersonService {
  constructor(
    private readonly tenantDb: TenantDbService,
    private readonly auditService: AuditService,
  ) {}

  /** RLS-scoped client inside a @TenantScoped request; privileged otherwise. */
  private get client(): Prisma.TransactionClient {
    return this.tenantDb.client;
  }

  /** Redact contact values unless the caller is authorized to see them. */
  private projectPerson(person: PersonDetail, canViewContact: boolean) {
    return {
      ...person,
      contactPoints: person.contactPoints.map((c) => ({
        id: c.id,
        kind: c.kind,
        label: c.label,
        isPrimary: c.isPrimary,
        verifiedAt: c.verifiedAt,
        value: canViewContact ? c.value : maskContactValue(c.kind, c.value),
        masked: !canViewContact,
      })),
    };
  }

  async create(
    tenantId: string,
    actorId: string | undefined,
    dto: CreatePersonDto,
  ) {
    if (dto.sourceId && !dto.sourceSystem) {
      throw new BadRequestException(
        'sourceSystem is required when sourceId is set',
      );
    }

    const person = await this.client.person.create({
      data: {
        id: randomUUID(),
        tenantId,
        firstName: dto.firstName,
        lastName: dto.lastName,
        middleName: dto.middleName ?? null,
        preferredName: dto.preferredName ?? null,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
        gender: dto.gender ?? null,
        nationality: dto.nationality ?? null,
        stateOfOrigin: dto.stateOfOrigin ?? null,
        lgaOfOrigin: dto.lgaOfOrigin ?? null,
        religion: dto.religion ?? null,
        attributes: (dto.attributes ?? {}) as Prisma.InputJsonValue,
        userTenantId: dto.userTenantId ?? null,
        sourceSystem: dto.sourceSystem ?? null,
        sourceId: dto.sourceId ?? null,
        createdBy: actorId ?? null,
      },
    });

    await this.client.relationshipHistory.create({
      data: {
        id: randomUUID(),
        tenantId,
        personId: person.id,
        changeType: 'created',
        summary: `Person ${person.firstName} ${person.lastName} created`,
        recordedBy: actorId ?? null,
      },
    });

    await this.audit(tenantId, actorId, 'person.create', person.id, {
      sourceSystem: person.sourceSystem,
      sourceId: person.sourceId,
    });

    return person;
  }

  async get(tenantId: string, id: string, canViewContact: boolean) {
    const person = await this.client.person.findFirst({
      where: { id, tenantId },
      include: PERSON_DETAIL_INCLUDE,
    });
    if (!person) throw new NotFoundException('Person not found');
    return this.projectPerson(person, canViewContact);
  }

  async list(
    tenantId: string,
    query: SearchPeopleDto,
    canViewContact: boolean,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const where: Prisma.PersonWhereInput = {
      tenantId,
      status: query.status ?? undefined,
    };
    if (query.q) {
      where.OR = [
        { firstName: { contains: query.q, mode: 'insensitive' } },
        { lastName: { contains: query.q, mode: 'insensitive' } },
        { preferredName: { contains: query.q, mode: 'insensitive' } },
      ];
    }
    if (query.hasStaffProfile) where.staffProfiles = { some: {} };
    if (query.isGuardian) where.guardianships = { some: { effectiveTo: null } };

    const [total, rows] = await Promise.all([
      this.client.person.count({ where }),
      this.client.person.findMany({
        where,
        include: PERSON_DETAIL_INCLUDE,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data: rows.map((r) => this.projectPerson(r, canViewContact)),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async update(
    tenantId: string,
    actorId: string | undefined,
    id: string,
    dto: UpdatePersonDto,
  ) {
    await this.ensureActive(tenantId, id);
    const person = await this.client.person.update({
      where: { id },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        middleName: dto.middleName,
        preferredName: dto.preferredName,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
        gender: dto.gender,
        nationality: dto.nationality,
        stateOfOrigin: dto.stateOfOrigin,
        lgaOfOrigin: dto.lgaOfOrigin,
        religion: dto.religion,
        attributes: dto.attributes as Prisma.InputJsonValue | undefined,
        updatedBy: actorId ?? null,
      },
    });
    await this.audit(tenantId, actorId, 'person.update', id, {});
    return person;
  }

  async addStaffProfile(
    tenantId: string,
    actorId: string | undefined,
    personId: string,
    dto: AddStaffProfileDto,
  ) {
    await this.ensureActive(tenantId, personId);
    try {
      const profile = await this.client.staffProfile.create({
        data: {
          id: randomUUID(),
          tenantId,
          personId,
          employeeNumber: dto.employeeNumber ?? null,
          employmentStatus: dto.employmentStatus ?? 'active',
          employmentType: dto.employmentType ?? null,
          jobTitle: dto.jobTitle ?? null,
          department: dto.department ?? null,
          hireDate: dto.hireDate ? new Date(dto.hireDate) : null,
          createdBy: actorId ?? null,
        },
      });
      await this.recordHistory(
        tenantId,
        personId,
        'profile_added',
        `Staff profile added${dto.jobTitle ? ` (${dto.jobTitle})` : ''}`,
        actorId,
        { staffProfileId: profile.id },
      );
      await this.audit(
        tenantId,
        actorId,
        'person.staff_profile.add',
        personId,
        {},
      );
      return profile;
    } catch (e) {
      if (isUniqueViolation(e)) {
        throw new ConflictException('Employee number already in use');
      }
      throw e;
    }
  }

  async addGuardianship(
    tenantId: string,
    actorId: string | undefined,
    guardianPersonId: string,
    dto: AddGuardianshipDto,
  ) {
    if (guardianPersonId === dto.wardPersonId) {
      throw new BadRequestException('A person cannot be their own guardian');
    }
    await this.ensureActive(tenantId, guardianPersonId);
    await this.ensureActive(tenantId, dto.wardPersonId);

    try {
      const rel = await this.client.guardianRelationship.create({
        data: {
          id: randomUUID(),
          tenantId,
          guardianPersonId,
          wardPersonId: dto.wardPersonId,
          relationship: dto.relationship ?? 'parent',
          isPrimary: dto.isPrimary ?? false,
          legalGuardian: dto.legalGuardian ?? false,
          contactPriority: dto.contactPriority ?? null,
          consentGiven: dto.consentGiven ?? false,
          createdBy: actorId ?? null,
        },
      });
      await this.recordHistory(
        tenantId,
        guardianPersonId,
        'relationship_added',
        'Guardian relationship added',
        actorId,
        { wardPersonId: dto.wardPersonId },
      );
      await this.recordHistory(
        tenantId,
        dto.wardPersonId,
        'relationship_added',
        'Guardian assigned',
        actorId,
        { guardianPersonId },
      );
      await this.audit(
        tenantId,
        actorId,
        'person.guardianship.add',
        guardianPersonId,
        {
          wardPersonId: dto.wardPersonId,
        },
      );
      return rel;
    } catch (e) {
      if (isUniqueViolation(e)) {
        throw new ConflictException('Guardian relationship already exists');
      }
      throw e;
    }
  }

  async addContact(
    tenantId: string,
    actorId: string | undefined,
    personId: string,
    dto: AddContactPointDto,
  ) {
    await this.ensureActive(tenantId, personId);
    const contact = await this.client.contactPoint.create({
      data: {
        id: randomUUID(),
        tenantId,
        personId,
        kind: dto.kind,
        value: dto.value.trim(),
        valueNormalized: normalizeContact(dto.kind, dto.value),
        label: dto.label ?? null,
        isPrimary: dto.isPrimary ?? false,
      },
    });
    await this.audit(tenantId, actorId, 'person.contact.add', personId, {
      contactId: contact.id,
      kind: contact.kind,
    });
    // The full value is never echoed back; the caller supplied it.
    return { id: contact.id, kind: contact.kind, isPrimary: contact.isPrimary };
  }

  /**
   * Issue a verification token for a contact (in production the token is
   * delivered via F5; here it is returned so the flow is testable end-to-end).
   */
  async issueContactVerification(
    tenantId: string,
    actorId: string | undefined,
    personId: string,
    contactId: string,
  ) {
    const contact = await this.client.contactPoint.findFirst({
      where: { id: contactId, personId, tenantId },
    });
    if (!contact) throw new NotFoundException('Contact not found');
    if (contact.verifiedAt) {
      throw new BadRequestException('Contact already verified');
    }
    const token = randomBytes(24).toString('base64url');
    const now = new Date();
    const expires = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    await this.client.contactPoint.update({
      where: { id: contactId },
      data: {
        verificationToken: token,
        verificationSentAt: now,
        verificationExpires: expires,
      },
    });
    await this.audit(
      tenantId,
      actorId,
      'person.contact.verify_issue',
      personId,
      {
        contactId,
      },
    );
    return { token, expiresAt: expires };
  }

  async confirmContactVerification(
    tenantId: string,
    actorId: string | undefined,
    token: string,
  ) {
    const contact = await this.client.contactPoint.findFirst({
      where: { tenantId, verificationToken: token },
    });
    if (!contact) throw new NotFoundException('Invalid verification token');
    if (
      contact.verificationExpires &&
      contact.verificationExpires < new Date()
    ) {
      throw new BadRequestException('Verification token expired');
    }
    await this.client.contactPoint.update({
      where: { id: contact.id },
      data: {
        verifiedAt: new Date(),
        verificationToken: null,
        verificationExpires: null,
      },
    });
    await this.recordHistory(
      tenantId,
      contact.personId,
      'contact_verified',
      `${contact.kind} verified`,
      actorId,
      { contactId: contact.id },
    );
    return { verified: true, contactId: contact.id };
  }

  private async ensureActive(tenantId: string, personId: string) {
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
      resource: 'person',
      resourceId,
      actorId: actorId ?? null,
      description: `${action} ${resourceId}`,
      metadata,
    });
  }
}

/** Prisma unique-constraint violation (P2002). */
function isUniqueViolation(e: unknown): boolean {
  return (
    e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002'
  );
}
