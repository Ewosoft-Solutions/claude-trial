import { Injectable } from '@nestjs/common';
import { Prisma } from '@workspace/database';

import { TenantDbService } from '../../common/database/tenant-db.service';
import { AuditService } from '../../common/audit/audit.service';
import { AUDIT_EVENT } from '../../common/audit/audit.constants';
import {
  AcademicsAccessService,
  type AcademicsActor,
} from '../../common/academics/academics-access.service';
import { maskContactValue } from '../../person/person.masking';
import type { StudentDirectoryQueryDto } from '../dto';

/**
 * The governed "students" projection behind the F7 directory pattern.
 *
 * Governance is enforced here, not in the UI:
 *  - **Tenant isolation**: every read goes through the RLS-scoped client, so a
 *    student in tenant A is invisible to tenant B (the DB enforces it).
 *  - **Record-level scope**: a class filter is honoured only for a class the
 *    actor may see (admins with the manage-all override, or the class teacher),
 *    mirroring the existing students list.
 *  - **Privacy (golden rule 7)**: contact detail is MASKED unless the caller
 *    holds the contact-PII scope; and the projection uses an explicit `select`
 *    that NEVER touches `healthInfo` / medical / safeguarding narrative, so
 *    that content is never returned or indexed by search.
 */

const FEE_TONE = {
  paid: 'success',
  partial: 'info',
  owing: 'destructive',
  none: 'neutral',
} as const;
type FeeStatus = keyof typeof FEE_TONE;

/** Safe, non-sensitive columns. Health/medical/safeguarding are omitted here. */
const STUDENT_SELECT = {
  id: true,
  personId: true,
  studentNumber: true,
  gradeLevel: true,
  enrollmentStatus: true,
  createdAt: true,
  userTenant: {
    select: {
      user: { select: { firstName: true, lastName: true, email: true } },
    },
  },
  enrollments: {
    where: { status: 'active' },
    take: 1,
    orderBy: { enrollmentDate: 'desc' },
    select: {
      class: {
        select: {
          name: true,
          section: true,
          course: { select: { name: true, code: true } },
        },
      },
    },
  },
  guardians: {
    take: 5,
    select: {
      isPrimary: true,
      guardian: {
        select: {
          user: { select: { firstName: true, lastName: true } },
        },
      },
    },
  },
} satisfies Prisma.StudentSelect;

type StudentRow = Prisma.StudentGetPayload<{ select: typeof STUDENT_SELECT }>;

export interface StudentDirectoryRow {
  id: string;
  /**
   * The Person this student anchors to (F1), when one exists. Nullable by
   * design: `Student.personId` is back-filled, so records created before the
   * person schema — or by a path that predates it — have none. The directory
   * uses it to open the shared person detail drawer; a null simply means that
   * drill-in is unavailable for the row, never an error.
   */
  personId: string | null;
  studentNumber: string;
  name: string;
  gradeLevel: string | null;
  enrollmentStatus: string;
  className: string;
  guardian: string;
  /** Student contact — masked when the caller lacks the PII scope. */
  contact: string;
  contactMasked: boolean;
  fee: {
    amountDue: number;
    amountPaid: number;
    status: FeeStatus;
  };
}

/**
 * Display name from first/last, falling back to a NON-PII value (the student
 * number) — never the email. Falling back to email would leak contact PII into
 * the always-visible `name` column for a name-less record, bypassing the mask.
 */
function displayName(
  user: { firstName: string | null; lastName: string | null },
  fallback: string,
): string {
  return [user.firstName, user.lastName].filter(Boolean).join(' ') || fallback;
}

function className(row: StudentRow): string {
  const cls = row.enrollments[0]?.class;
  if (!cls) return '—';
  const composed = [cls.course?.name, cls.section]
    .filter(Boolean)
    .join(' ')
    .trim();
  return cls.name || composed || cls.course?.code || '—';
}

function guardianName(row: StudentRow): string {
  const primary = row.guardians.find((g) => g.isPrimary) ?? row.guardians[0];
  if (!primary) return '—';
  const { firstName, lastName } = primary.guardian.user;
  return [firstName, lastName].filter(Boolean).join(' ') || '—';
}

function feeStatus(amountDue: number, amountPaid: number): FeeStatus {
  if (amountDue <= 0) return 'none';
  if (amountPaid >= amountDue) return 'paid';
  if (amountPaid > 0) return 'partial';
  return 'owing';
}

@Injectable()
export class StudentDirectoryService {
  constructor(
    private readonly tenantDb: TenantDbService,
    private readonly academicsAccess: AcademicsAccessService,
    private readonly auditService: AuditService,
  ) {}

  private get client(): Prisma.TransactionClient {
    return this.tenantDb.client;
  }

  private orderBy(
    query: StudentDirectoryQueryDto,
  ): Prisma.StudentOrderByWithRelationInput[] {
    const dir = query.dir ?? 'asc';
    switch (query.sort) {
      case 'studentNumber':
        return [{ studentNumber: dir }];
      case 'gradeLevel':
        return [{ gradeLevel: dir }, { studentNumber: 'asc' }];
      case 'status':
        return [{ enrollmentStatus: dir }, { studentNumber: 'asc' }];
      case 'createdAt':
        return [{ createdAt: dir }];
      case 'name':
      default:
        return [
          { userTenant: { user: { lastName: dir } } },
          { userTenant: { user: { firstName: dir } } },
        ];
    }
  }

  private async buildWhere(
    tenantId: string,
    actor: AcademicsActor,
    canViewContact: boolean,
    query: StudentDirectoryQueryDto,
  ): Promise<Prisma.StudentWhereInput> {
    const where: Prisma.StudentWhereInput = { tenantId };
    if (query.status) where.enrollmentStatus = query.status;
    if (query.gradeLevel) where.gradeLevel = query.gradeLevel;
    if (query.q) {
      // Search only over non-PII identifiers + names. The email is included
      // ONLY for a caller who may already see it — otherwise the search becomes
      // an association oracle (search a known email → confirm which named
      // student it belongs to), which would defeat the contact mask.
      const userOr: Prisma.UserWhereInput['OR'] = [
        { firstName: { contains: query.q, mode: 'insensitive' } },
        { lastName: { contains: query.q, mode: 'insensitive' } },
      ];
      if (canViewContact) {
        userOr.push({ email: { contains: query.q, mode: 'insensitive' } });
      }
      where.OR = [
        { studentNumber: { contains: query.q, mode: 'insensitive' } },
        { admissionNumber: { contains: query.q, mode: 'insensitive' } },
        { userTenant: { user: { OR: userOr } } },
      ];
    }
    if (query.classId) {
      // Record-level scope: a non-admin actor may filter by a class only if
      // they teach it (mirrors StudentService.list).
      if (!actor.canManageAll) {
        await this.academicsAccess.assertCanManageClass(
          tenantId,
          actor,
          query.classId,
        );
      }
      where.enrollments = {
        some: { classId: query.classId, status: 'active' },
      };
    }
    return where;
  }

  /** Sum FeeInvoice due/paid per student for the current page only. */
  private async feesByStudent(
    studentIds: string[],
  ): Promise<Map<string, { amountDue: number; amountPaid: number }>> {
    const map = new Map<string, { amountDue: number; amountPaid: number }>();
    if (studentIds.length === 0) return map;
    const grouped = await this.client.feeInvoice.groupBy({
      by: ['studentId'],
      where: { studentId: { in: studentIds } },
      _sum: { amountDue: true, amountPaid: true },
    });
    for (const g of grouped) {
      map.set(g.studentId, {
        amountDue: g._sum.amountDue ?? 0,
        amountPaid: g._sum.amountPaid ?? 0,
      });
    }
    return map;
  }

  private project(
    row: StudentRow,
    canViewContact: boolean,
  ): StudentDirectoryRow {
    const email = row.userTenant.user.email;
    return {
      id: row.id,
      personId: row.personId,
      studentNumber: row.studentNumber,
      name: displayName(row.userTenant.user, row.studentNumber),
      gradeLevel: row.gradeLevel,
      enrollmentStatus: row.enrollmentStatus,
      className: className(row),
      guardian: guardianName(row),
      contact: canViewContact ? email : maskContactValue('email', email),
      contactMasked: !canViewContact,
      // fee filled by the caller (needs the page-wide aggregate)
      fee: { amountDue: 0, amountPaid: 0, status: 'none' },
    };
  }

  async list(
    tenantId: string,
    actor: AcademicsActor,
    canViewContact: boolean,
    query: StudentDirectoryQueryDto,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const where = await this.buildWhere(tenantId, actor, canViewContact, query);

    const [total, rows] = await Promise.all([
      this.client.student.count({ where }),
      this.client.student.findMany({
        where,
        select: STUDENT_SELECT,
        orderBy: this.orderBy(query),
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const fees = await this.feesByStudent(rows.map((r) => r.id));
    const data = rows.map((row) => {
      const projected = this.project(row, canViewContact);
      const fee = fees.get(row.id);
      if (fee) {
        projected.fee = {
          amountDue: fee.amountDue,
          amountPaid: fee.amountPaid,
          status: feeStatus(fee.amountDue, fee.amountPaid),
        };
      }
      return projected;
    });

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      meta: { canViewContact },
    };
  }

  /**
   * Export the selected rows as CSV. A governed bulk action: gated on
   * `students.export` at the controller, honours the same masking as the list
   * (an exporter without the PII scope gets masked contact), and is AUDITED as
   * a data export. This is the in-request directory export, distinct from the
   * async governed DataExportJob platform (F9).
   */
  async export(
    tenantId: string,
    actorId: string | undefined,
    canViewContact: boolean,
    ids: string[],
  ): Promise<{ filename: string; mimeType: string; content: string }> {
    const rows = await this.client.student.findMany({
      where: { tenantId, id: { in: ids } },
      select: STUDENT_SELECT,
      orderBy: [
        { userTenant: { user: { lastName: 'asc' } } },
        { userTenant: { user: { firstName: 'asc' } } },
      ],
    });
    const projected = rows.map((row) => {
      const p = this.project(row, canViewContact);
      return p;
    });

    const header = [
      'Student number',
      'Name',
      'Grade',
      'Status',
      'Class',
      'Guardian',
      'Contact',
    ];
    const lines = [
      header.map(csvCell).join(','),
      ...projected.map((r) =>
        [
          r.studentNumber,
          r.name,
          r.gradeLevel ?? '',
          r.enrollmentStatus,
          r.className,
          r.guardian,
          r.contact,
        ]
          .map(csvCell)
          .join(','),
      ),
    ];

    await this.auditService.write({
      tenantId,
      eventType: AUDIT_EVENT.DATA_CHANGE,
      action: 'directory.students.export',
      resource: 'student',
      actorId: actorId ?? null,
      description: `Exported ${projected.length} student row(s) from the directory`,
      metadata: {
        count: projected.length,
        requested: ids.length,
        contactMasked: !canViewContact,
      },
    });

    return {
      filename: `students-export-${new Date().toISOString().slice(0, 10)}.csv`,
      mimeType: 'text/csv',
      content: lines.join('\r\n'),
    };
  }
}

/**
 * CSV field escaping. Two concerns:
 *  1. RFC-4180: quote when the value contains a comma/quote/newline.
 *  2. Formula/DDE injection: a spreadsheet evaluates a cell that starts with
 *     `= + - @` (or tab/CR) as a formula — with user-controlled names this is a
 *     data-exfiltration / command vector. Neutralize by prefixing a `'` so the
 *     cell is treated as text. RFC quoting alone does NOT prevent this (Excel
 *     strips the quotes, then evaluates the formula).
 */
function csvCell(value: string): string {
  const guarded = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  const needsQuote = /[",\r\n]/.test(guarded);
  const escaped = guarded.replace(/"/g, '""');
  return needsQuote ? `"${escaped}"` : escaped;
}
