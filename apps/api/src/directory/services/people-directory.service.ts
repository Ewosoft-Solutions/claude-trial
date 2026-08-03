import { Injectable } from '@nestjs/common';
import { Prisma } from '@workspace/database';

import { TenantDbService } from '../../common/database/tenant-db.service';
import { AuditService } from '../../common/audit/audit.service';
import { AUDIT_EVENT } from '../../common/audit/audit.constants';
import { maskContactValue } from '../../person/person.masking';
import type { PeopleDirectoryQueryDto, PeopleType } from '../dto';

/**
 * The governed **People** projection behind the WB1-1 unified directory.
 *
 * One searchable directory over the F1 `Person` domain, presented as person-type
 * tabs (student / guardian / staff / user) plus a `prospect` tab that projects
 * over `AdmissionApplication` (a prospect becomes a Person only on admission).
 * Because the four person tabs project the SAME `Person` anchor, a human who is
 * both staff and a guardian is ONE identity carrying two profiles (the WB1
 * acceptance) — every row lists every profile it holds via `profiles`.
 *
 * Governance is enforced here + at the controller, never in the UI:
 *  - **Tenant isolation**: every read goes through the RLS-scoped client, so a
 *    person in tenant A is invisible to tenant B (the DB enforces it).
 *  - **Per-tab permission**: the controller gates the workbench on `people.view`
 *    and each tab on its type permission (`students.view` / `guardians.view` /
 *    `staff.view` / `users.view` / `admissions.view`) — a caller without a tab's
 *    permission is refused that tab server-side.
 *  - **Privacy (golden rule 7)**: contact detail is MASKED unless the caller
 *    holds `people.view_contact`; and the projection uses an explicit `select`
 *    that NEVER touches `healthInfo` / medical / safeguarding narrative (those
 *    live on `Student`/`HealthRecord`, not on the columns selected here).
 */

export type PeopleProfileKind = 'student' | 'guardian' | 'staff' | 'user';

export interface PeopleDirectoryRow {
  /** Person.id for the four person tabs; AdmissionApplication.id for prospects. */
  id: string;
  name: string;
  /** Contact — masked unless the caller holds `people.view_contact`. */
  contact: string;
  contactMasked: boolean;
  /**
   * Every profile this ONE identity holds — the "one person, many roles" view
   * that makes the staff-and-guardian acceptance visible on any tab. Empty for
   * prospects (no Person yet).
   */
  profiles: PeopleProfileKind[];
  /** Primary tab-specific identifier (student no. / role / wards / applying-for). */
  primary: string;
  /** Secondary tab-specific detail (grade / department / ward names / guardian). */
  secondary: string;
  /** Raw status key for the tab (client maps to a tone); null when N/A. */
  status: string | null;
}

export interface PeopleDirectoryResult {
  data: PeopleDirectoryRow[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  meta: { canViewContact: boolean; type: PeopleType };
}

/**
 * Safe, non-sensitive Person columns + the minimal relation fields each tab
 * needs. Health/medical/safeguarding are never referenced. `staffProfiles`
 * shows the most-recent employment (incl. terminated, so the status filter can
 * find it); `guardianships` shows only current (open-ended) caregiver links.
 */
const PERSON_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  preferredName: true,
  createdAt: true,
  userTenantId: true,
  contactPoints: {
    orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    take: 1,
    select: { kind: true, value: true },
  },
  studentProfile: {
    select: { studentNumber: true, gradeLevel: true, enrollmentStatus: true },
  },
  staffProfiles: {
    orderBy: { createdAt: 'desc' },
    take: 1,
    select: {
      employeeNumber: true,
      jobTitle: true,
      department: true,
      employmentStatus: true,
    },
  },
  guardianships: {
    where: { effectiveTo: null },
    orderBy: [{ isPrimary: 'desc' }],
    take: 5,
    select: {
      relationship: true,
      isPrimary: true,
      ward: { select: { firstName: true, lastName: true } },
    },
  },
  account: {
    select: { status: true, user: { select: { email: true } } },
  },
} satisfies Prisma.PersonSelect;

type PersonRow = Prisma.PersonGetPayload<{ select: typeof PERSON_SELECT }>;

const PROSPECT_SELECT = {
  id: true,
  applicantName: true,
  applyingFor: true,
  guardianName: true,
  guardianEmail: true,
  guardianPhone: true,
  stage: true,
  decision: true,
  submittedDate: true,
} satisfies Prisma.AdmissionApplicationSelect;

type ProspectRow = Prisma.AdmissionApplicationGetPayload<{
  select: typeof PROSPECT_SELECT;
}>;

function personName(row: {
  firstName: string;
  lastName: string;
  preferredName: string | null;
}): string {
  return (
    [row.firstName, row.lastName].filter(Boolean).join(' ') ||
    row.preferredName ||
    'Unnamed person'
  );
}

function guardianName(g: {
  firstName: string | null;
  lastName: string | null;
}): string {
  return [g.firstName, g.lastName].filter(Boolean).join(' ') || 'Ward';
}

/** Resolve the row's display contact: a primary ContactPoint, else the login email. */
function resolveContact(
  row: PersonRow,
): { kind: string; value: string } | null {
  const point = row.contactPoints[0];
  if (point) return { kind: point.kind, value: point.value };
  const email = row.account?.user?.email;
  if (email) return { kind: 'email', value: email };
  return null;
}

function profilesOf(row: PersonRow): PeopleProfileKind[] {
  const profiles: PeopleProfileKind[] = [];
  if (row.studentProfile) profiles.push('student');
  if (row.guardianships.length > 0) profiles.push('guardian');
  if (row.staffProfiles.length > 0) profiles.push('staff');
  if (row.userTenantId) profiles.push('user');
  return profiles;
}

@Injectable()
export class PeopleDirectoryService {
  constructor(
    private readonly tenantDb: TenantDbService,
    private readonly auditService: AuditService,
  ) {}

  private get client(): Prisma.TransactionClient {
    return this.tenantDb.client;
  }

  // ---- Person-type tabs (student / guardian / staff / user) ---------------

  private personWhere(
    tenantId: string,
    type: PeopleType,
    canViewContact: boolean,
    query: PeopleDirectoryQueryDto,
  ): Prisma.PersonWhereInput {
    const where: Prisma.PersonWhereInput = { tenantId, status: 'active' };
    const status = query.status;

    switch (type) {
      case 'student':
        where.studentProfile = status
          ? { is: { enrollmentStatus: status } }
          : { isNot: null };
        break;
      case 'staff':
        where.staffProfiles = {
          some: status ? { employmentStatus: status } : {},
        };
        break;
      case 'guardian':
        // A current caregiver: an open-ended guardian relationship.
        where.guardianships = { some: { effectiveTo: null } };
        break;
      case 'user':
        where.account = status ? { is: { status } } : { isNot: null };
        break;
    }

    if (query.q) {
      // Search names + the tab's non-PII identifier. The contact index is added
      // ONLY for a caller who may already see contact — otherwise the search
      // becomes an association oracle that defeats the mask (mirrors F7).
      const or: Prisma.PersonWhereInput[] = [
        { firstName: { contains: query.q, mode: 'insensitive' } },
        { lastName: { contains: query.q, mode: 'insensitive' } },
        { preferredName: { contains: query.q, mode: 'insensitive' } },
      ];
      if (type === 'student') {
        or.push({
          studentProfile: {
            is: { studentNumber: { contains: query.q, mode: 'insensitive' } },
          },
        });
      }
      if (type === 'staff') {
        or.push({
          staffProfiles: {
            some: {
              employeeNumber: { contains: query.q, mode: 'insensitive' },
            },
          },
        });
      }
      if (canViewContact) {
        or.push({
          contactPoints: {
            some: {
              valueNormalized: {
                contains: query.q.toLowerCase(),
              },
            },
          },
        });
      }
      where.OR = or;
    }

    return where;
  }

  private personOrderBy(
    query: PeopleDirectoryQueryDto,
  ): Prisma.PersonOrderByWithRelationInput[] {
    const dir = query.dir ?? 'asc';
    if (query.sort === 'createdAt') return [{ createdAt: dir }];
    return [{ lastName: dir }, { firstName: dir }];
  }

  private projectPerson(
    row: PersonRow,
    type: PeopleType,
    canViewContact: boolean,
  ): PeopleDirectoryRow {
    const contact = resolveContact(row);
    const staff = row.staffProfiles[0];
    const wards = row.guardianships.map((g) => guardianName(g.ward));

    let primary = '—';
    let secondary = '—';
    let status: string | null = null;

    switch (type) {
      case 'student':
        primary = row.studentProfile?.studentNumber ?? '—';
        secondary = row.studentProfile?.gradeLevel ?? '—';
        status = row.studentProfile?.enrollmentStatus ?? null;
        break;
      case 'staff':
        primary = staff?.jobTitle ?? staff?.employeeNumber ?? '—';
        secondary = staff?.department ?? '—';
        status = staff?.employmentStatus ?? null;
        break;
      case 'guardian':
        primary = `${wards.length} ward${wards.length === 1 ? '' : 's'}`;
        secondary =
          wards.slice(0, 2).join(', ') +
          (wards.length > 2 ? ` +${wards.length - 2}` : '');
        status = row.guardianships.some((g) => g.isPrimary)
          ? 'primary'
          : 'secondary';
        break;
      case 'user':
        primary = row.studentProfile
          ? 'Student'
          : staff?.jobTitle
            ? 'Staff'
            : '—';
        secondary = '—';
        status = row.account?.status ?? null;
        break;
    }

    return {
      id: row.id,
      name: personName(row),
      contact: contact
        ? canViewContact
          ? contact.value
          : maskContactValue(contact.kind, contact.value)
        : '—',
      contactMasked: !!contact && !canViewContact,
      profiles: profilesOf(row),
      primary,
      secondary,
      status,
    };
  }

  private async listPersons(
    tenantId: string,
    type: PeopleType,
    canViewContact: boolean,
    query: PeopleDirectoryQueryDto,
  ): Promise<PeopleDirectoryResult> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const where = this.personWhere(tenantId, type, canViewContact, query);

    const [total, rows] = await Promise.all([
      this.client.person.count({ where }),
      this.client.person.findMany({
        where,
        select: PERSON_SELECT,
        orderBy: this.personOrderBy(query),
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data: rows.map((row) => this.projectPerson(row, type, canViewContact)),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      meta: { canViewContact, type },
    };
  }

  // ---- Prospect tab (AdmissionApplication) --------------------------------

  private projectProspect(
    row: ProspectRow,
    canViewContact: boolean,
  ): PeopleDirectoryRow {
    const raw = row.guardianEmail
      ? { kind: 'email', value: row.guardianEmail }
      : row.guardianPhone
        ? { kind: 'phone', value: row.guardianPhone }
        : null;
    return {
      id: row.id,
      name: row.applicantName,
      contact: raw
        ? canViewContact
          ? raw.value
          : maskContactValue(raw.kind, raw.value)
        : '—',
      contactMasked: !!raw && !canViewContact,
      profiles: [],
      primary: row.applyingFor,
      secondary: row.guardianName,
      status: row.decision,
    };
  }

  private async listProspects(
    tenantId: string,
    canViewContact: boolean,
    query: PeopleDirectoryQueryDto,
  ): Promise<PeopleDirectoryResult> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const dir = query.dir ?? 'asc';
    const where: Prisma.AdmissionApplicationWhereInput = { tenantId };
    if (query.status) where.decision = query.status;
    if (query.q) {
      where.OR = [
        { applicantName: { contains: query.q, mode: 'insensitive' } },
        { guardianName: { contains: query.q, mode: 'insensitive' } },
        { applyingFor: { contains: query.q, mode: 'insensitive' } },
      ];
    }
    const orderBy: Prisma.AdmissionApplicationOrderByWithRelationInput[] =
      query.sort === 'name'
        ? [{ applicantName: dir }]
        : [{ submittedDate: dir }];

    const [total, rows] = await Promise.all([
      this.client.admissionApplication.count({ where }),
      this.client.admissionApplication.findMany({
        where,
        select: PROSPECT_SELECT,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data: rows.map((row) => this.projectProspect(row, canViewContact)),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      meta: { canViewContact, type: 'prospect' },
    };
  }

  // ---- Public API ---------------------------------------------------------

  async list(
    tenantId: string,
    type: PeopleType,
    canViewContact: boolean,
    query: PeopleDirectoryQueryDto,
  ): Promise<PeopleDirectoryResult> {
    if (type === 'prospect') {
      return this.listProspects(tenantId, canViewContact, query);
    }
    return this.listPersons(tenantId, type, canViewContact, query);
  }

  /**
   * Export the selected rows of a tab as CSV. A governed bulk action: gated on
   * the tab's type permission at the controller, honours the same masking as
   * the list, and is AUDITED as a data export.
   */
  async export(
    tenantId: string,
    type: PeopleType,
    actorId: string | undefined,
    canViewContact: boolean,
    ids: string[],
  ): Promise<{ filename: string; mimeType: string; content: string }> {
    const rows =
      type === 'prospect'
        ? (
            await this.client.admissionApplication.findMany({
              where: { tenantId, id: { in: ids } },
              select: PROSPECT_SELECT,
              orderBy: [{ applicantName: 'asc' }],
            })
          ).map((r) => this.projectProspect(r, canViewContact))
        : (
            await this.client.person.findMany({
              where: { tenantId, id: { in: ids } },
              select: PERSON_SELECT,
              orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
            })
          ).map((r) => this.projectPerson(r, type, canViewContact));

    const { primaryHeader, secondaryHeader, statusHeader } = HEADERS[type];
    const header = [
      'Name',
      primaryHeader,
      secondaryHeader,
      statusHeader,
      'Profiles',
      'Contact',
    ];
    const lines = [
      header.map(csvCell).join(','),
      ...rows.map((r) =>
        [
          r.name,
          r.primary,
          r.secondary,
          r.status ?? '',
          r.profiles.join(' / '),
          r.contact,
        ]
          .map(csvCell)
          .join(','),
      ),
    ];

    await this.auditService.write({
      tenantId,
      eventType: AUDIT_EVENT.DATA_CHANGE,
      action: 'directory.people.export',
      resource: 'person',
      actorId: actorId ?? null,
      description: `Exported ${rows.length} ${type} row(s) from the People directory`,
      metadata: {
        type,
        count: rows.length,
        requested: ids.length,
        contactMasked: !canViewContact,
      },
    });

    return {
      filename: `people-${type}-export-${new Date().toISOString().slice(0, 10)}.csv`,
      mimeType: 'text/csv',
      content: lines.join('\r\n'),
    };
  }
}

/** Per-tab CSV column labels for the type-specific fields. */
const HEADERS: Record<
  PeopleType,
  { primaryHeader: string; secondaryHeader: string; statusHeader: string }
> = {
  student: {
    primaryHeader: 'Student number',
    secondaryHeader: 'Grade',
    statusHeader: 'Enrollment',
  },
  guardian: {
    primaryHeader: 'Wards',
    secondaryHeader: 'Ward names',
    statusHeader: 'Priority',
  },
  staff: {
    primaryHeader: 'Role',
    secondaryHeader: 'Department',
    statusHeader: 'Employment',
  },
  user: {
    primaryHeader: 'Account type',
    secondaryHeader: '',
    statusHeader: 'Account status',
  },
  prospect: {
    primaryHeader: 'Applying for',
    secondaryHeader: 'Guardian',
    statusHeader: 'Decision',
  },
};

/**
 * CSV field escaping (identical to the F7 students export):
 *  1. RFC-4180 quoting for comma/quote/newline.
 *  2. Formula/DDE-injection neutralization — a spreadsheet evaluates a cell
 *     starting with `= + - @` (or tab/CR) as a formula; prefix a `'` so the
 *     user-controlled value is treated as text.
 */
function csvCell(value: string): string {
  const guarded = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  const needsQuote = /[",\r\n]/.test(guarded);
  const escaped = guarded.replace(/"/g, '""');
  return needsQuote ? `"${escaped}"` : escaped;
}
