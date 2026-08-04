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
import type {
  AddQualificationDto,
  CreateEmploymentDto,
  DisableEmploymentDto,
  UpdateEmploymentDto,
} from '../dto/employment.dto';

/**
 * Staff employment (WB1-2) — the first-class HR record, MANAGED here rather than
 * derived from a payroll run (retires payroll-as-directory, ADR-01). Every
 * mutation is server-side permission-gated at the controller, tenant-isolated by
 * RLS (the `person` schema client), and audited.
 *
 *   • list     — a person's employment record(s) + qualifications + reporting line
 *   • create   — open an employment INDEPENDENT of any payroll run
 *   • update   — position / department / type / number / status / reporting line
 *   • disable  — end an employment (status→terminated + end date + reason)
 *   • qualifications — add / remove
 *   • managers — active staff in the tenant, to pick a reporting line
 *
 * Must run inside a `@TenantScoped` request (the client is RLS-scoped).
 */
@Injectable()
export class StaffEmploymentService {
  constructor(
    private readonly tenantDb: TenantDbService,
    private readonly audit: AuditService,
  ) {}

  private get client(): Prisma.TransactionClient {
    return this.tenantDb.client;
  }

  /** Parse a YYYY-MM-DD date-only string to a Date, or null. */
  private parseDate(value: string | undefined): Date | null {
    if (!value) return null;
    const d = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(d.getTime())) {
      throw new BadRequestException('Invalid date');
    }
    return d;
  }

  private async loadPerson(tenantId: string, personId: string) {
    const person = await this.client.person.findFirst({
      where: { id: personId, tenantId },
      select: { id: true, status: true, firstName: true, lastName: true },
    });
    if (!person) throw new NotFoundException('Person not found');
    return person;
  }

  /** Load an employment in the caller's tenant, or 404. */
  private async loadEmployment(tenantId: string, employmentId: string) {
    const employment = await this.client.staffProfile.findFirst({
      where: { id: employmentId, tenantId },
      select: { id: true, personId: true, employmentStatus: true },
    });
    if (!employment) throw new NotFoundException('Employment record not found');
    return employment;
  }

  /**
   * Validate a proposed reporting line: the manager must exist in the tenant, be
   * a different employment, and not create a cycle (walking up the manager's own
   * chain must never reach this employment). Returns the validated manager id.
   */
  private async resolveReportingLine(
    tenantId: string,
    employmentId: string | null,
    managerId: string,
  ): Promise<string> {
    if (employmentId && managerId === employmentId) {
      throw new BadRequestException('An employment cannot report to itself');
    }
    const manager = await this.client.staffProfile.findFirst({
      where: { id: managerId, tenantId },
      select: { id: true, reportsToStaffProfileId: true },
    });
    if (!manager) {
      throw new BadRequestException('Reporting-line manager not found');
    }
    // Cycle guard: follow the manager's chain upward; if it loops back to this
    // employment we would create a cycle. Bounded to avoid a runaway on dirty
    // data.
    if (employmentId) {
      let cursor: string | null = manager.reportsToStaffProfileId;
      for (let depth = 0; cursor && depth < 50; depth += 1) {
        if (cursor === employmentId) {
          throw new BadRequestException(
            'That reporting line would create a cycle',
          );
        }
        const next: { reportsToStaffProfileId: string | null } | null =
          await this.client.staffProfile.findFirst({
            where: { id: cursor, tenantId },
            select: { reportsToStaffProfileId: true },
          });
        cursor = next?.reportsToStaffProfileId ?? null;
      }
    }
    return manager.id;
  }

  private employmentInclude() {
    return {
      reportsTo: {
        select: {
          id: true,
          jobTitle: true,
          person: {
            select: { firstName: true, lastName: true, preferredName: true },
          },
        },
      },
      qualifications: {
        orderBy: [{ awardedYear: 'desc' }, { createdAt: 'desc' }],
        select: {
          id: true,
          title: true,
          qualificationType: true,
          institution: true,
          fieldOfStudy: true,
          awardedYear: true,
          documentId: true,
        },
      },
      _count: { select: { directReports: true } },
    } satisfies Prisma.StaffProfileInclude;
  }

  private displayName(p: {
    firstName: string | null;
    lastName: string | null;
    preferredName: string | null;
  }): string {
    return (
      (
        p.preferredName || [p.firstName, p.lastName].filter(Boolean).join(' ')
      )?.trim() || 'Unnamed'
    );
  }

  private project(
    row: Prisma.StaffProfileGetPayload<{
      include: ReturnType<StaffEmploymentService['employmentInclude']>;
    }>,
  ) {
    return {
      id: row.id,
      employeeNumber: row.employeeNumber,
      jobTitle: row.jobTitle,
      department: row.department,
      employmentType: row.employmentType,
      employmentStatus: row.employmentStatus,
      hireDate: row.hireDate ? row.hireDate.toISOString() : null,
      endDate: row.endDate ? row.endDate.toISOString() : null,
      endReason: row.endReason,
      sourceSystem: row.sourceSystem,
      reportsTo: row.reportsTo
        ? {
            id: row.reportsTo.id,
            name: this.displayName(row.reportsTo.person),
            jobTitle: row.reportsTo.jobTitle,
          }
        : null,
      directReportCount: row._count.directReports,
      qualifications: row.qualifications,
    };
  }

  /** A person's employment record(s), newest first. */
  async listForPerson(tenantId: string, personId: string) {
    await this.loadPerson(tenantId, personId);
    const rows = await this.client.staffProfile.findMany({
      where: { tenantId, personId },
      orderBy: { createdAt: 'desc' },
      include: this.employmentInclude(),
    });
    return { data: rows.map((r) => this.project(r)) };
  }

  /** Open a new employment for a person — no payroll run required. */
  async create(
    tenantId: string,
    actorId: string,
    personId: string,
    dto: CreateEmploymentDto,
  ) {
    const person = await this.loadPerson(tenantId, personId);
    if (person.status !== 'active') {
      throw new ConflictException(`Person is ${person.status}, not active`);
    }

    const reportsToId = dto.reportsToStaffProfileId
      ? await this.resolveReportingLine(
          tenantId,
          null,
          dto.reportsToStaffProfileId,
        )
      : null;

    const created = await this.client.staffProfile
      .create({
        data: {
          tenantId,
          personId,
          jobTitle: dto.jobTitle ?? null,
          department: dto.department ?? null,
          employmentType: dto.employmentType ?? null,
          employeeNumber: dto.employeeNumber ?? null,
          hireDate: this.parseDate(dto.hireDate),
          reportsToStaffProfileId: reportsToId,
          employmentStatus: 'active',
          createdBy: actorId,
          updatedBy: actorId,
        },
        include: this.employmentInclude(),
      })
      .catch((e) => {
        // Employee number is unique per tenant.
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === 'P2002'
        ) {
          throw new ConflictException(
            'That employee number is already in use at this school',
          );
        }
        throw e;
      });

    await this.audit.write({
      tenantId,
      eventType: AUDIT_EVENT.DATA_CHANGE,
      action: 'employment.create',
      resource: 'staff_profile',
      resourceId: created.id,
      actorId,
      description: `opened employment for person ${personId}`,
      metadata: { personId, jobTitle: created.jobTitle },
    });

    return this.project(created);
  }

  /** Update an employment's details / status / reporting line. */
  async update(
    tenantId: string,
    actorId: string,
    employmentId: string,
    dto: UpdateEmploymentDto,
  ) {
    const employment = await this.loadEmployment(tenantId, employmentId);

    const data: Prisma.StaffProfileUpdateInput = { updatedBy: actorId };
    if (dto.jobTitle !== undefined) data.jobTitle = dto.jobTitle;
    if (dto.department !== undefined) data.department = dto.department;
    if (dto.employmentType !== undefined)
      data.employmentType = dto.employmentType;
    if (dto.employeeNumber !== undefined)
      data.employeeNumber = dto.employeeNumber;
    if (dto.hireDate !== undefined)
      data.hireDate = this.parseDate(dto.hireDate);
    if (dto.employmentStatus !== undefined) {
      data.employmentStatus = dto.employmentStatus;
      // Re-opening a previously-ended stint clears the end fields.
      data.endDate = null;
      data.endReason = null;
    }
    if (dto.reportsToStaffProfileId !== undefined) {
      data.reportsTo =
        dto.reportsToStaffProfileId === null
          ? { disconnect: true }
          : {
              connect: {
                id: await this.resolveReportingLine(
                  tenantId,
                  employmentId,
                  dto.reportsToStaffProfileId,
                ),
              },
            };
    }

    const updated = await this.client.staffProfile
      .update({
        where: { id: employment.id },
        data,
        include: this.employmentInclude(),
      })
      .catch((e) => {
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === 'P2002'
        ) {
          throw new ConflictException(
            'That employee number is already in use at this school',
          );
        }
        throw e;
      });

    await this.audit.write({
      tenantId,
      eventType: AUDIT_EVENT.DATA_CHANGE,
      action: 'employment.update',
      resource: 'staff_profile',
      resourceId: employment.id,
      actorId,
      description: `updated employment ${employment.id}`,
      metadata: { fields: Object.keys(dto) },
    });

    return this.project(updated);
  }

  /**
   * Disable (end) an employment — the acceptance action: works with no payroll
   * run in sight. Sets status→terminated, records the end date + reason.
   */
  async disable(
    tenantId: string,
    actorId: string,
    employmentId: string,
    dto: DisableEmploymentDto,
  ) {
    const employment = await this.loadEmployment(tenantId, employmentId);
    if (employment.employmentStatus === 'terminated') {
      throw new ConflictException('This employment is already ended');
    }

    const updated = await this.client.staffProfile.update({
      where: { id: employment.id },
      data: {
        employmentStatus: 'terminated',
        endDate: this.parseDate(dto.endDate) ?? new Date(),
        endReason: dto.reason ?? null,
        updatedBy: actorId,
      },
      include: this.employmentInclude(),
    });

    await this.audit.write({
      tenantId,
      eventType: AUDIT_EVENT.DATA_CHANGE,
      action: 'employment.disable',
      resource: 'staff_profile',
      resourceId: employment.id,
      actorId,
      description: `ended employment ${employment.id}`,
      metadata: { reason: dto.reason ?? null },
    });

    return this.project(updated);
  }

  /** Add a qualification to an employment record. */
  async addQualification(
    tenantId: string,
    actorId: string,
    employmentId: string,
    dto: AddQualificationDto,
  ) {
    const employment = await this.loadEmployment(tenantId, employmentId);
    const created = await this.client.staffQualification.create({
      data: {
        tenantId,
        staffProfileId: employment.id,
        title: dto.title,
        qualificationType: dto.qualificationType ?? null,
        institution: dto.institution ?? null,
        fieldOfStudy: dto.fieldOfStudy ?? null,
        awardedYear: dto.awardedYear ?? null,
        documentId: dto.documentId ?? null,
        createdBy: actorId,
      },
      select: {
        id: true,
        title: true,
        qualificationType: true,
        institution: true,
        fieldOfStudy: true,
        awardedYear: true,
        documentId: true,
      },
    });

    await this.audit.write({
      tenantId,
      eventType: AUDIT_EVENT.DATA_CHANGE,
      action: 'employment.qualification.add',
      resource: 'staff_qualification',
      resourceId: created.id,
      actorId,
      description: `added qualification "${dto.title}"`,
      metadata: { staffProfileId: employment.id },
    });

    return created;
  }

  /** Remove a qualification (scoped to the caller's tenant). */
  async removeQualification(
    tenantId: string,
    actorId: string,
    qualificationId: string,
  ) {
    const existing = await this.client.staffQualification.findFirst({
      where: { id: qualificationId, tenantId },
      select: { id: true, staffProfileId: true },
    });
    if (!existing) throw new NotFoundException('Qualification not found');

    await this.client.staffQualification.delete({ where: { id: existing.id } });

    await this.audit.write({
      tenantId,
      eventType: AUDIT_EVENT.DATA_CHANGE,
      action: 'employment.qualification.remove',
      resource: 'staff_qualification',
      resourceId: existing.id,
      actorId,
      description: `removed qualification ${existing.id}`,
      metadata: { staffProfileId: existing.staffProfileId },
    });

    return { removed: true };
  }

  /**
   * Active staff in the tenant, to populate a reporting-line picker. Excludes an
   * optional employment (you cannot pick yourself) and ended stints.
   */
  async managers(tenantId: string, excludeEmploymentId?: string) {
    const rows = await this.client.staffProfile.findMany({
      where: {
        tenantId,
        employmentStatus: { not: 'terminated' },
        ...(excludeEmploymentId ? { id: { not: excludeEmploymentId } } : {}),
      },
      orderBy: [{ jobTitle: 'asc' }],
      take: 500,
      select: {
        id: true,
        jobTitle: true,
        department: true,
        person: {
          select: { firstName: true, lastName: true, preferredName: true },
        },
      },
    });
    return {
      data: rows.map((r) => ({
        id: r.id,
        name: this.displayName(r.person),
        jobTitle: r.jobTitle,
        department: r.department,
      })),
    };
  }
}
