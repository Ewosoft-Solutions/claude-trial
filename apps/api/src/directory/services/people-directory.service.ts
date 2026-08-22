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
  /** Primary email — masked unless the caller holds `people.view_contact`. */
  email: string | null;
  /** Primary phone — masked unless the caller holds `people.view_contact`. */
  phone: string | null;
  /** True when email/phone were redacted (caller lacks `people.view_contact`). */
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

/** A cross-linkable related person (a ward, or a guardian). */
export interface PersonDetailRelation {
  id: string;
  name: string;
  /** e.g. 'parent' | 'guardian', or the priority for a ward's guardian. */
  relationship: string;
  isPrimary: boolean;
}

export interface PersonAddress {
  kind: string;
  line1: string;
  line2: string | null;
  city: string | null;
  /** State / Province / Region. */
  subdivision: string | null;
  /** NG LGA (second-level). */
  subdivisionLga: string | null;
  country: string;
  isPrimary: boolean;
}

export interface PersonContactPoint {
  kind: string; // 'email' | 'phone'
  /** Masked unless the caller holds `people.view_contact`. */
  value: string;
  label: string | null;
  isPrimary: boolean;
  verified: boolean;
}

export interface PersonContactPreference {
  channel: string; // 'sms' | 'email' | 'push' | 'in_app'
  optedIn: boolean;
  isDnd: boolean;
}

/** A step in a known-flow lifecycle (admission / enrollment / employment). */
export interface PersonTimelineStep {
  key: string;
  label: string;
  date: string | null;
  state: 'done' | 'current' | 'pending';
  detail: string | null;
}

/** At-a-glance boolean signals for the header chips. */
export interface PersonDetailFlags {
  hasSiblings?: boolean;
  feesOverdue?: boolean;
  attendanceRisk?: boolean;
  newAdmission?: boolean;
  onLeave?: boolean;
  /** Prospect: a sibling is already enrolled (guardian matched an existing student). */
  siblingEnrolled?: boolean;
}

/** Student academics roll-up (needs grades/attendance view). */
export interface AcademicsSummary {
  attendancePercent: number | null;
  averageGradePercent: number | null;
  currentClasses: {
    id: string;
    name: string;
    term: string | null;
    status: string;
    finalGrade: string | null;
  }[];
}

/** Student finance roll-up in minor units / kobo (needs `finance.view`). */
export interface FinanceSummary {
  balance: number;
  totalDue: number;
  totalPaid: number;
  overdueCount: number;
  nextDueDate: string | null;
}

/** Documents roll-up (needs `documents.view`). */
export interface DocumentsSummary {
  count: number;
  recent: {
    id: string;
    title: string;
    type: string | null;
    scanStatus: string;
    createdAt: string;
  }[];
}

/**
 * The fuller per-person projection behind the detail drawer / profile page.
 * Sections are present only when the caller holds the matching profile / domain
 * permission (layered model, resolved at the controller); contact is masked
 * without `people.view_contact`. Health/safeguarding is never referenced.
 */
export interface PersonDetail {
  id: string;
  type: PeopleType;
  name: string;
  preferredName: string | null;
  profiles: PeopleProfileKind[];
  /** Student.id when this person has a student profile (for per-student tabs). */
  studentId: string | null;
  // Identity
  dateOfBirth: string | null;
  gender: string | null;
  nationality: string | null;
  stateOfOrigin: string | null;
  lgaOfOrigin: string | null;
  addresses: PersonAddress[];
  // Contact
  email: string | null;
  phone: string | null;
  contactMasked: boolean;
  contactPoints: PersonContactPoint[];
  contactPreferences: PersonContactPreference[];
  // Cross-cutting
  timeline: PersonTimelineStep[];
  flags: PersonDetailFlags;
  // Role sections
  student: {
    studentNumber: string | null;
    gradeLevel: string | null;
    enrollmentStatus: string | null;
    admissionDate: string | null;
    guardians: PersonDetailRelation[];
    siblings: PersonDetailRelation[];
  } | null;
  staff:
    | {
        employeeNumber: string | null;
        jobTitle: string | null;
        department: string | null;
        employmentStatus: string;
        employmentType: string | null;
        hireDate: string | null;
      }[]
    | null;
  /** Wards this person is a guardian of. */
  wards: PersonDetailRelation[] | null;
  account: {
    status: string;
    email: string | null;
    role: string | null;
    lastLoginAt: string | null;
  } | null;
  prospect: {
    applyingFor: string;
    guardianName: string;
    stage: string;
    decision: string | null;
    submittedDate: string | null;
  } | null;
  // Cross-domain roll-ups (null when not applicable or not permitted)
  academics: AcademicsSummary | null;
  finance: FinanceSummary | null;
  documents: DocumentsSummary | null;
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
    // Ordered primary-first so the first email/phone we encounter is the one to
    // show. Bounded — a person rarely has more than a couple of each.
    orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    take: 20,
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

/**
 * The richer per-person select behind the detail drawer / profile page — adds
 * both relationship directions (wards + guardians) and the full staff/account
 * detail. Health/safeguarding is still never referenced.
 */
const RELATION_PERSON = {
  id: true,
  firstName: true,
  lastName: true,
  preferredName: true,
} as const;

const DETAIL_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  preferredName: true,
  userTenantId: true,
  dateOfBirth: true,
  gender: true,
  nationality: true,
  stateOfOrigin: true,
  lgaOfOrigin: true,
  contactPoints: {
    orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    take: 20,
    select: {
      kind: true,
      value: true,
      label: true,
      isPrimary: true,
      verifiedAt: true,
    },
  },
  addresses: {
    orderBy: [{ isPrimary: 'desc' }],
    select: {
      kind: true,
      line1: true,
      line2: true,
      city: true,
      subdivision: true,
      subdivisionLga: true,
      country: true,
      isPrimary: true,
    },
  },
  studentProfile: {
    select: {
      id: true,
      studentNumber: true,
      gradeLevel: true,
      enrollmentStatus: true,
      admissionDate: true,
      enrollmentDate: true,
      graduationDate: true,
      withdrawalDate: true,
      transferDate: true,
    },
  },
  staffProfiles: {
    orderBy: { createdAt: 'desc' },
    select: {
      employeeNumber: true,
      jobTitle: true,
      department: true,
      employmentStatus: true,
      employmentType: true,
      hireDate: true,
    },
  },
  guardianships: {
    where: { effectiveTo: null },
    orderBy: [{ isPrimary: 'desc' }],
    select: {
      relationship: true,
      isPrimary: true,
      ward: { select: RELATION_PERSON },
    },
  },
  wardLinks: {
    where: { effectiveTo: null },
    orderBy: [{ isPrimary: 'desc' }],
    select: {
      relationship: true,
      isPrimary: true,
      guardian: { select: RELATION_PERSON },
    },
  },
  account: {
    select: {
      status: true,
      addedAt: true,
      user: { select: { email: true, lastLoginAt: true } },
      userTenantRole: { select: { role: { select: { name: true } } } },
    },
  },
} satisfies Prisma.PersonSelect;

type PersonDetailRow = Prisma.PersonGetPayload<{
  select: typeof DETAIL_SELECT;
}>;

/**
 * Which per-profile detail sections the caller may see — the layered model:
 * the endpoint requires `people.view` + the active tab's type permission, and
 * each SECTION is included only when the caller also holds that profile's
 * permission. Resolved at the controller.
 */
export interface PersonDetailPerms {
  students: boolean;
  staff: boolean;
  guardians: boolean;
  users: boolean;
  /** Domain roll-up gates (Academics needs grades OR attendance view). */
  academics: boolean;
  finance: boolean;
  documents: boolean;
}

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

/**
 * Resolve the row's display email + phone from its (primary-first) contact
 * points, falling back to the login email when there's no email contact point.
 */
function resolveContacts(row: {
  contactPoints: { kind: string; value: string }[];
  account?: { user: { email: string } | null } | null;
}): { email: string | null; phone: string | null } {
  let email: string | null = null;
  let phone: string | null = null;
  for (const cp of row.contactPoints) {
    if (cp.kind === 'email') email ??= cp.value;
    else if (cp.kind === 'phone') phone ??= cp.value;
  }
  email ??= row.account?.user?.email ?? null;
  return { email, phone };
}

/** Apply the contact mask (or not) to a resolved email/phone pair. */
function presentContacts(
  contacts: { email: string | null; phone: string | null },
  canViewContact: boolean,
): { email: string | null; phone: string | null; contactMasked: boolean } {
  const has = !!contacts.email || !!contacts.phone;
  return {
    email: contacts.email
      ? canViewContact
        ? contacts.email
        : maskContactValue('email', contacts.email)
      : null,
    phone: contacts.phone
      ? canViewContact
        ? contacts.phone
        : maskContactValue('phone', contacts.phone)
      : null,
    contactMasked: has && !canViewContact,
  };
}

function profilesOf(row: {
  studentProfile: unknown | null;
  guardianships: unknown[];
  staffProfiles: unknown[];
  userTenantId: string | null;
}): PeopleProfileKind[] {
  const profiles: PeopleProfileKind[] = [];
  if (row.studentProfile) profiles.push('student');
  if (row.guardianships.length > 0) profiles.push('guardian');
  if (row.staffProfiles.length > 0) profiles.push('staff');
  if (row.userTenantId) profiles.push('user');
  return profiles;
}

/* ---- Person-detail helpers ---------------------------------------------- */

function iso(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}

function isRecent(d: Date | null, days = 30): boolean {
  return !!d && Date.now() - d.getTime() < days * 24 * 60 * 60 * 1000;
}

function relationOf(
  p: {
    id: string;
    firstName: string;
    lastName: string;
    preferredName: string | null;
  },
  relationship: string,
  isPrimary: boolean,
): PersonDetailRelation {
  return { id: p.id, name: personName(p), relationship, isPrimary };
}

function presentContactPoints(
  points: {
    kind: string;
    value: string;
    label: string | null;
    isPrimary: boolean;
    verifiedAt: Date | null;
  }[],
  canViewContact: boolean,
): PersonContactPoint[] {
  return points.map((p) => ({
    kind: p.kind,
    value: canViewContact ? p.value : maskContactValue(p.kind, p.value),
    label: p.label,
    isPrimary: p.isPrimary,
    verified: p.verifiedAt !== null,
  }));
}

/** The null-filled detail skeleton the two projections spread over. */
function baseDetail(id: string, type: PeopleType, name: string): PersonDetail {
  return {
    id,
    type,
    name,
    preferredName: null,
    profiles: [],
    studentId: null,
    dateOfBirth: null,
    gender: null,
    nationality: null,
    stateOfOrigin: null,
    lgaOfOrigin: null,
    addresses: [],
    email: null,
    phone: null,
    contactMasked: false,
    contactPoints: [],
    contactPreferences: [],
    timeline: [],
    flags: {},
    student: null,
    staff: null,
    wards: null,
    account: null,
    prospect: null,
    academics: null,
    finance: null,
    documents: null,
  };
}

/**
 * Admission pipeline summary — Submitted → Interview / assessment → Decision.
 *
 * Collapses the canonical WB3 stage machine (ADMISSION_STAGES in
 * apps/api/src/admissions/dto/admissions.dto.ts —
 * enquiry → applied → screening → interview → offer → accepted → enrolled, with
 * rejected / withdrawn terminal) into the three milestones this compact
 * directory timeline shows, driven by the stage's progress rank. This surface
 * carries only the current stage + decision (not the AdmissionStageEvent
 * history), so it summarises position rather than reconstructing the exact path.
 */
function buildAdmissionTimeline(row: {
  submittedDate: Date;
  stage: string;
  decision: string;
}): PersonTimelineStep[] {
  // Linear progress rank; rejected / withdrawn are terminal and sit off the line.
  const RANK: Record<string, number> = {
    enquiry: 0,
    applied: 1,
    screening: 2,
    interview: 3,
    offer: 4,
    accepted: 5,
    enrolled: 6,
  };
  const rank = RANK[row.stage] ?? 0;
  const terminal = row.stage === 'rejected' || row.stage === 'withdrawn';
  // A decision is reached once it's non-pending or the application has ended.
  const decided = row.decision !== 'pending' || terminal;

  const interviewState: PersonTimelineStep['state'] =
    decided || rank > 3
      ? 'done'
      : row.stage === 'interview' || row.stage === 'screening'
        ? 'current'
        : 'pending';

  const decisionState: PersonTimelineStep['state'] = decided
    ? 'done'
    : row.stage === 'offer'
      ? 'current'
      : 'pending';

  // Prefer the recorded decision; a withdrawal is named explicitly since its
  // decision usually stays 'pending'.
  const decisionDetail =
    row.stage === 'withdrawn'
      ? 'withdrawn'
      : row.decision !== 'pending'
        ? row.decision
        : null;

  return [
    {
      key: 'submitted',
      label: 'Application submitted',
      date: iso(row.submittedDate),
      state: 'done',
      detail: null,
    },
    {
      key: 'interview',
      label: 'Interview / assessment',
      date: null,
      state: interviewState,
      detail: null,
    },
    {
      key: 'decision',
      label: 'Decision',
      date: null,
      state: decisionState,
      detail: decisionDetail,
    },
  ];
}

/** Student enrolment / staff employment lifecycle. */
function buildPersonTimeline(row: PersonDetailRow): PersonTimelineStep[] {
  const sp = row.studentProfile;
  if (sp) {
    const steps: PersonTimelineStep[] = [];
    if (sp.admissionDate) {
      steps.push({
        key: 'admitted',
        label: 'Admitted',
        date: iso(sp.admissionDate),
        state: 'done',
        detail: null,
      });
    }
    steps.push({
      key: 'enrolled',
      label: 'Enrolled',
      date: iso(sp.enrollmentDate),
      state: sp.enrollmentStatus === 'active' ? 'current' : 'done',
      detail: null,
    });
    const exit =
      sp.enrollmentStatus === 'graduated'
        ? { label: 'Graduated', date: sp.graduationDate }
        : sp.enrollmentStatus === 'withdrawn'
          ? { label: 'Withdrawn', date: sp.withdrawalDate }
          : sp.enrollmentStatus === 'transferred'
            ? { label: 'Transferred', date: sp.transferDate }
            : null;
    if (exit) {
      steps.push({
        key: 'exit',
        label: exit.label,
        date: iso(exit.date),
        state: 'done',
        detail: null,
      });
    }
    return steps;
  }
  const staff = row.staffProfiles[0];
  if (staff) {
    return [
      {
        key: 'hired',
        label: 'Hired',
        date: iso(staff.hireDate),
        state: 'done',
        detail: null,
      },
      {
        key: 'current',
        label: 'Current status',
        date: null,
        state: 'current',
        detail: staff.employmentStatus,
      },
    ];
  }
  return [];
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
      case 'all':
        // The unified roster: no profile-existence filter. Optional filters:
        // `status` = account status; `role` = holds that profile.
        if (status) where.account = { is: { status } };
        if (query.role === 'student') where.studentProfile = { isNot: null };
        else if (query.role === 'guardian')
          where.guardianships = { some: { effectiveTo: null } };
        else if (query.role === 'staff') where.staffProfiles = { some: {} };
        else if (query.role === 'user') where.userTenantId = { not: null };
        break;
      case 'student': {
        const student: Prisma.StudentWhereInput = {};
        if (status) student.enrollmentStatus = status;
        if (query.grade) student.gradeLevel = query.grade;
        where.studentProfile =
          Object.keys(student).length > 0 ? { is: student } : { isNot: null };
        break;
      }
      case 'staff': {
        const staff: Prisma.StaffProfileWhereInput = {};
        if (status) staff.employmentStatus = status;
        if (query.department) staff.department = query.department;
        where.staffProfiles = { some: staff };
        break;
      }
      case 'guardian': {
        // A current caregiver: an open-ended guardian relationship. On this tab
        // the `status` filter means PRIORITY (primary contact vs. secondary).
        const link: Prisma.GuardianRelationshipWhereInput = {
          effectiveTo: null,
        };
        if (status === 'primary') link.isPrimary = true;
        else if (status === 'secondary') link.isPrimary = false;
        where.guardianships = { some: link };
        break;
      }
      case 'user':
        where.account = status ? { is: { status } } : { isNot: null };
        break;
    }

    // Has-contact filter — applies to every person tab (not prospects).
    if (query.hasContact === 'true') where.contactPoints = { some: {} };
    else if (query.hasContact === 'false') where.contactPoints = { none: {} };

    const q = query.q?.trim();
    if (q) {
      // Tokenise the query so each word must match SOME name field: "Grace Ade"
      // matches firstName "Grace" AND lastName "Adeyemi". A single-field
      // `contains` on the whole string only ever matched one word, so anything
      // past the first space returned nothing. Identifiers + the contact index
      // still match the whole query. The contact index is added ONLY for a
      // caller who may already see contact — otherwise search becomes an
      // association oracle that defeats the mask (mirrors F7).
      const tokens = q.split(/\s+/);
      const nameMatch: Prisma.PersonWhereInput[] = tokens.map((t) => ({
        OR: [
          { firstName: { contains: t, mode: 'insensitive' } },
          { lastName: { contains: t, mode: 'insensitive' } },
          { preferredName: { contains: t, mode: 'insensitive' } },
        ],
      }));
      const or: Prisma.PersonWhereInput[] = [{ AND: nameMatch }];
      // `match=name` restricts to names only — used by the name picker, where
      // matching a hidden email/identifier would surface people whose visible
      // name does not contain the query (e.g. every ".test" email matches "te").
      if (query.match !== 'name') {
        if (type === 'student') {
          or.push({
            studentProfile: {
              is: { studentNumber: { contains: q, mode: 'insensitive' } },
            },
          });
        }
        if (type === 'staff') {
          or.push({
            staffProfiles: {
              some: {
                employeeNumber: { contains: q, mode: 'insensitive' },
              },
            },
          });
        }
        if (canViewContact) {
          or.push({
            contactPoints: {
              some: {
                valueNormalized: {
                  contains: q.toLowerCase(),
                },
              },
            },
          });
        }
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
    const contact = presentContacts(resolveContacts(row), canViewContact);
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
      case 'all':
        // A coarse "type" label; the full role set is in `profiles`. The status
        // chip shows account state (null for a person with no login).
        primary = row.studentProfile
          ? 'Student'
          : staff?.jobTitle
            ? 'Staff'
            : row.guardianships.length > 0
              ? 'Guardian'
              : row.userTenantId
                ? 'User'
                : '—';
        secondary = '—';
        status = row.account?.status ?? null;
        break;
    }

    return {
      id: row.id,
      name: personName(row),
      email: contact.email,
      phone: contact.phone,
      contactMasked: contact.contactMasked,
      profiles: profilesOf(row),
      primary,
      secondary,
      status,
    };
  }

  /**
   * The row select. For the Staff tab with a status filter, narrow the SELECTED
   * employment to that status so the rendered chip matches the filter — a person
   * with more than one `StaffProfile` (a rehire, per person.prisma) could
   * otherwise be matched on an old stint yet shown with the most-recent stint's
   * (different) status. The payload shape is identical to `PERSON_SELECT`.
   */
  private personSelect(type: PeopleType, status?: string) {
    if (type === 'staff' && status) {
      return {
        ...PERSON_SELECT,
        staffProfiles: {
          where: { employmentStatus: status },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            employeeNumber: true,
            jobTitle: true,
            department: true,
            employmentStatus: true,
          },
        },
      } satisfies Prisma.PersonSelect;
    }
    return PERSON_SELECT;
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

    // Sequential, not Promise.all: `runScoped` pins the unit of work to one
    // interactive-transaction connection, so two concurrent queries on it trip
    // node-postgres' "client already executing a query" deprecation (and gain no
    // real parallelism on a single connection).
    const total = await this.client.person.count({ where });
    const rows = (await this.client.person.findMany({
      where,
      select: this.personSelect(type, query.status),
      orderBy: this.personOrderBy(query),
      skip: (page - 1) * limit,
      take: limit,
    })) as PersonRow[];

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
    const contact = presentContacts(
      { email: row.guardianEmail ?? null, phone: row.guardianPhone ?? null },
      canViewContact,
    );
    return {
      id: row.id,
      name: row.applicantName,
      email: contact.email,
      phone: contact.phone,
      contactMasked: contact.contactMasked,
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

    // Sequential (see listPersons): one pinned RLS-transaction connection.
    const total = await this.client.admissionApplication.count({ where });
    const rows = await this.client.admissionApplication.findMany({
      where,
      select: PROSPECT_SELECT,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    });

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
   * Distinct grade-levels + departments for the tenant, to populate the
   * Students/Staff filter dropdowns. Tenant-scoped by RLS.
   */
  async facets(
    tenantId: string,
  ): Promise<{ grades: string[]; departments: string[] }> {
    const grades = await this.client.student.findMany({
      where: { tenantId, gradeLevel: { not: null } },
      distinct: ['gradeLevel'],
      select: { gradeLevel: true },
      orderBy: { gradeLevel: 'asc' },
    });
    const departments = await this.client.staffProfile.findMany({
      where: { tenantId, department: { not: null } },
      distinct: ['department'],
      select: { department: true },
      orderBy: { department: 'asc' },
    });
    return {
      grades: grades
        .map((g) => g.gradeLevel)
        .filter((v): v is string => v !== null),
      departments: departments
        .map((d) => d.department)
        .filter((v): v is string => v !== null),
    };
  }

  /**
   * The fuller per-person projection behind the detail drawer / profile page.
   * Returns null when the id isn't found in the caller's tenant (RLS-scoped).
   * Each section is included only when `perms` grants it; contact is masked
   * without `people.view_contact`.
   */
  /**
   * Detail for an id whose KIND the caller did not state.
   *
   * A prospect lives in a different table from everyone else, so `detail`
   * needs to be told which to read. The profile page cannot tell it: its
   * chrome is a layout, and a layout cannot read the query string that used
   * to carry the answer. So the server resolves it — people first, since
   * they vastly outnumber prospects, and an application id only ever reaches
   * the second lookup. Returns the detail with `type` set to what was
   * actually found, which the caller must authorise before handing it out.
   */
  async detailById(
    tenantId: string,
    id: string,
    perms: PersonDetailPerms,
    canViewContact: boolean,
  ): Promise<PersonDetail | null> {
    const person = await this.detail(
      tenantId,
      id,
      'all',
      perms,
      canViewContact,
    );
    if (person) return person;
    return this.detail(tenantId, id, 'prospect', perms, canViewContact);
  }

  async detail(
    tenantId: string,
    id: string,
    type: PeopleType,
    perms: PersonDetailPerms,
    canViewContact: boolean,
  ): Promise<PersonDetail | null> {
    if (type === 'prospect') {
      const row = await this.client.admissionApplication.findFirst({
        where: { tenantId, id },
        select: PROSPECT_SELECT,
      });
      if (!row) return null;
      const contact = presentContacts(
        { email: row.guardianEmail ?? null, phone: row.guardianPhone ?? null },
        canViewContact,
      );
      const siblingEnrolled = await this.prospectSiblingEnrolled(tenantId, row);
      return {
        ...baseDetail(row.id, 'prospect', row.applicantName),
        email: contact.email,
        phone: contact.phone,
        contactMasked: contact.contactMasked,
        timeline: buildAdmissionTimeline(row),
        flags: { siblingEnrolled },
        prospect: {
          applyingFor: row.applyingFor,
          guardianName: row.guardianName,
          stage: row.stage,
          decision: row.decision,
          submittedDate: iso(row.submittedDate),
        },
      };
    }

    const row = (await this.client.person.findFirst({
      where: { tenantId, id },
      select: DETAIL_SELECT,
    })) as PersonDetailRow | null;
    if (!row) return null;

    const contact = presentContacts(resolveContacts(row), canViewContact);
    const studentId = row.studentProfile?.id ?? null;

    // Sequential — the RLS-scoped client is pinned to one connection (see
    // listPersons); concurrent queries on it trip node-postgres.
    const siblings = studentId ? await this.siblingsOf(tenantId, row) : [];
    const academics =
      studentId && perms.academics
        ? await this.academicsSummary(studentId)
        : null;
    const finance =
      studentId && perms.finance ? await this.financeSummary(studentId) : null;
    const documents = perms.documents
      ? await this.documentsSummary(row.id, studentId)
      : null;
    const contactPreferences = canViewContact
      ? await this.client.contactPreference.findMany({
          where: { tenantId, personId: row.id },
          select: { channel: true, optedIn: true, isDnd: true },
        })
      : [];

    return {
      id: row.id,
      type,
      name: personName(row),
      preferredName: row.preferredName,
      profiles: profilesOf(row),
      studentId,
      dateOfBirth: iso(row.dateOfBirth),
      gender: row.gender,
      nationality: row.nationality,
      stateOfOrigin: row.stateOfOrigin,
      lgaOfOrigin: row.lgaOfOrigin,
      addresses: row.addresses.map((a) => ({
        kind: a.kind,
        line1: a.line1,
        line2: a.line2,
        city: a.city,
        subdivision: a.subdivision,
        subdivisionLga: a.subdivisionLga,
        country: a.country,
        isPrimary: a.isPrimary,
      })),
      email: contact.email,
      phone: contact.phone,
      contactMasked: contact.contactMasked,
      contactPoints: presentContactPoints(row.contactPoints, canViewContact),
      contactPreferences,
      timeline: buildPersonTimeline(row),
      flags: {
        hasSiblings: siblings.length > 0,
        feesOverdue: (finance?.overdueCount ?? 0) > 0,
        attendanceRisk:
          academics?.attendancePercent != null &&
          academics.attendancePercent < 85,
        newAdmission: isRecent(row.studentProfile?.admissionDate ?? null),
        onLeave: row.staffProfiles.some(
          (s) => s.employmentStatus === 'on_leave',
        ),
      },
      student:
        perms.students && row.studentProfile
          ? {
              studentNumber: row.studentProfile.studentNumber,
              gradeLevel: row.studentProfile.gradeLevel,
              enrollmentStatus: row.studentProfile.enrollmentStatus,
              admissionDate: iso(row.studentProfile.admissionDate),
              guardians: row.wardLinks.map((w) =>
                relationOf(w.guardian, w.relationship, w.isPrimary),
              ),
              siblings,
            }
          : null,
      staff:
        perms.staff && row.staffProfiles.length > 0
          ? row.staffProfiles.map((s) => ({
              employeeNumber: s.employeeNumber,
              jobTitle: s.jobTitle,
              department: s.department,
              employmentStatus: s.employmentStatus,
              employmentType: s.employmentType,
              hireDate: iso(s.hireDate),
            }))
          : null,
      wards:
        perms.guardians && row.guardianships.length > 0
          ? row.guardianships.map((g) =>
              relationOf(g.ward, g.relationship, g.isPrimary),
            )
          : null,
      account:
        perms.users && row.account
          ? {
              status: row.account.status,
              email: row.account.user?.email ?? null,
              role: row.account.userTenantRole?.role?.name ?? null,
              lastLoginAt: iso(row.account.user?.lastLoginAt ?? null),
            }
          : null,
      prospect: null,
      academics,
      finance,
      documents,
    };
  }

  /** Other current wards of this student's guardians (excluding self). */
  private async siblingsOf(
    tenantId: string,
    row: PersonDetailRow,
  ): Promise<PersonDetailRelation[]> {
    const guardianIds = row.wardLinks.map((w) => w.guardian.id);
    if (guardianIds.length === 0) return [];
    const links = await this.client.guardianRelationship.findMany({
      where: {
        tenantId,
        effectiveTo: null,
        guardianPersonId: { in: guardianIds },
        wardPersonId: { not: row.id },
      },
      select: { ward: { select: RELATION_PERSON } },
    });
    const seen = new Set<string>();
    const siblings: PersonDetailRelation[] = [];
    for (const link of links) {
      if (seen.has(link.ward.id)) continue;
      seen.add(link.ward.id);
      siblings.push(relationOf(link.ward, 'sibling', false));
    }
    return siblings;
  }

  /** Attendance %, average grade %, and current classes for a student. */
  private async academicsSummary(studentId: string): Promise<AcademicsSummary> {
    const attendance = await this.client.attendanceRecord.findMany({
      where: { studentId },
      select: { status: true },
    });
    const grades = await this.client.grade.findMany({
      where: { enrollment: { studentId }, percentage: { not: null } },
      select: { percentage: true },
    });
    const enrollments = await this.client.enrollment.findMany({
      where: { studentId },
      orderBy: { enrollmentDate: 'desc' },
      take: 10,
      select: {
        status: true,
        finalGrade: true,
        class: { select: { id: true, name: true, section: true } },
        term: { select: { name: true } },
      },
    });
    const attendancePercent =
      attendance.length > 0
        ? Math.round(
            (attendance.filter((a) => a.status === 'present').length /
              attendance.length) *
              100,
          )
        : null;
    const averageGradePercent =
      grades.length > 0
        ? Math.round(
            grades.reduce((sum, g) => sum + Number(g.percentage), 0) /
              grades.length,
          )
        : null;
    return {
      attendancePercent,
      averageGradePercent,
      currentClasses: enrollments.map((e) => ({
        id: e.class.id,
        name: e.class.name ?? e.class.section,
        term: e.term?.name ?? null,
        status: e.status,
        finalGrade: e.finalGrade,
      })),
    };
  }

  /** Fee balance (minor units), overdue count, and next due date for a student. */
  private async financeSummary(studentId: string): Promise<FinanceSummary> {
    const invoices = await this.client.feeInvoice.findMany({
      where: { studentId },
      select: {
        amountDue: true,
        amountPaid: true,
        status: true,
        dueDate: true,
      },
    });
    let totalDue = 0;
    let totalPaid = 0;
    let overdueCount = 0;
    let nextDueDate: Date | null = null;
    for (const inv of invoices) {
      totalDue += inv.amountDue;
      totalPaid += inv.amountPaid;
      if (inv.status === 'overdue') overdueCount += 1;
      if (inv.amountDue > inv.amountPaid && inv.dueDate) {
        if (!nextDueDate || inv.dueDate < nextDueDate)
          nextDueDate = inv.dueDate;
      }
    }
    return {
      balance: totalDue - totalPaid,
      totalDue,
      totalPaid,
      overdueCount,
      nextDueDate: iso(nextDueDate),
    };
  }

  /** Documents owned by this person (or their student profile). */
  private async documentsSummary(
    personId: string,
    studentId: string | null,
  ): Promise<DocumentsSummary> {
    const owners: Prisma.DocumentWhereInput[] = [
      { ownerType: 'person', ownerId: personId },
    ];
    if (studentId) owners.push({ ownerType: 'student', ownerId: studentId });
    const docs = await this.client.document.findMany({
      where: { OR: owners },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        scanStatus: true,
        createdAt: true,
        type: { select: { label: true } },
      },
    });
    return {
      count: docs.length,
      // Cap the embedded list; the drawer shows a few, the profile tab all.
      recent: docs.slice(0, 25).map((d) => ({
        id: d.id,
        title: d.title ?? 'Untitled',
        type: d.type?.label ?? null,
        scanStatus: d.scanStatus,
        createdAt: iso(d.createdAt) ?? '',
      })),
    };
  }

  /** Prospect at-a-glance: a sibling is already enrolled (guardian email matches). */
  private async prospectSiblingEnrolled(
    tenantId: string,
    row: { guardianEmail: string | null },
  ): Promise<boolean> {
    if (!row.guardianEmail) return false;
    const match = await this.client.person.findFirst({
      where: {
        tenantId,
        contactPoints: {
          some: { valueNormalized: row.guardianEmail.toLowerCase() },
        },
        guardianships: {
          some: {
            effectiveTo: null,
            ward: { studentProfile: { isNot: null } },
          },
        },
      },
      select: { id: true },
    });
    return match !== null;
  }

  /**
   * Per-tab record counts for the summary cards. Counts only the `types` the
   * caller is authorized for (resolved at the controller), so a card is never
   * shown for a tab the caller can't open. Counts run sequentially — one pinned
   * RLS-transaction connection (see listPersons).
   */
  async summary(
    tenantId: string,
    types: PeopleType[],
  ): Promise<Record<string, number>> {
    const counts: Record<string, number> = {};
    for (const type of types) {
      counts[type] =
        type === 'prospect'
          ? await this.client.admissionApplication.count({
              where: { tenantId },
            })
          : await this.client.person.count({
              where: this.personWhere(tenantId, type, false, {}),
            });
    }
    return counts;
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
      'Email',
      'Phone',
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
          r.email ?? '',
          r.phone ?? '',
        ]
          .map(csvCell)
          .join(','),
      ),
    ];

    await this.auditService.write({
      tenantId,
      eventType: AUDIT_EVENT.DATA_CHANGE,
      action: 'directory.people.export',
      resource: type === 'prospect' ? 'admission_application' : 'person',
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
  all: {
    primaryHeader: 'Type',
    secondaryHeader: '',
    statusHeader: 'Account status',
  },
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
