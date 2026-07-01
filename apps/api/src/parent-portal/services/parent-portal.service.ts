import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../common/database/database.service';
import { TenantDbService } from '../../common/database/tenant-db.service';

export interface ChildSummary {
  studentId: string;
  firstName: string;
  lastName: string;
  initials: string;
  gradeLevel: string | null;
  /** Percentage of recorded attendance days marked present, 0-100. Null when no records exist yet. */
  attendancePercent: number | null;
  /** Average of graded assessment percentages, 0-100. Null when nothing has been graded yet. */
  averageGradePercent: number | null;
  /** Total billed across invoices, minor units (kobo). */
  feeTotalDue: number;
  /** Total paid across invoices, minor units (kobo). */
  feeTotalPaid: number;
  /** Outstanding balance, minor units (kobo): feeTotalDue - feeTotalPaid. */
  feeBalance: number;
}

@Injectable()
export class ParentPortalService {
  constructor(
    private readonly db: DatabaseService,
    private readonly tenantDb: TenantDbService,
  ) {}

  private get client() {
    return this.tenantDb.isScoped ? this.tenantDb.client : this.db.client;
  }

  /**
   * Every child linked to the calling guardian profile, each with real
   * attendance/grade/fee aggregates — not mock data. A child with no
   * recorded attendance or grades yet correctly shows null/empty rather
   * than a fabricated number.
   *
   * Scoped entirely by `guardianProfileId` (the calling profile's own id,
   * from the access token) — there is no parameter for querying another
   * guardian's children, so this can only ever return the caller's own.
   */
  async getMyChildren(tenantId: string, guardianProfileId: string): Promise<ChildSummary[]> {
    const guardianLinks = await this.client.studentGuardian.findMany({
      where: { tenantId, userTenantId: guardianProfileId },
      include: {
        student: {
          include: {
            userTenant: {
              include: {
                user: { select: { firstName: true, lastName: true } },
              },
            },
          },
        },
      },
    });

    return Promise.all(
      guardianLinks.map(async ({ student }) => {
        const [attendanceRecords, grades, invoices] = await Promise.all([
          this.client.attendanceRecord.findMany({
            where: { tenantId, studentId: student.id },
            select: { status: true },
          }),
          this.client.grade.findMany({
            where: { tenantId, enrollment: { studentId: student.id }, percentage: { not: null } },
            select: { percentage: true },
          }),
          this.client.feeInvoice.findMany({
            where: { tenantId, studentId: student.id },
            select: { amountDue: true, amountPaid: true },
          }),
        ]);

        const attendancePercent =
          attendanceRecords.length > 0
            ? Math.round(
                (attendanceRecords.filter((r) => r.status === 'present').length /
                  attendanceRecords.length) *
                  100,
              )
            : null;

        const averageGradePercent =
          grades.length > 0
            ? Math.round(
                grades.reduce((sum, g) => sum + Number(g.percentage), 0) / grades.length,
              )
            : null;

        const feeTotalDue = invoices.reduce((sum, inv) => sum + inv.amountDue, 0);
        const feeTotalPaid = invoices.reduce((sum, inv) => sum + inv.amountPaid, 0);

        const firstName = student.userTenant.user.firstName ?? '';
        const lastName = student.userTenant.user.lastName ?? '';

        return {
          studentId: student.id,
          firstName,
          lastName,
          initials:
            [firstName[0], lastName[0]].filter(Boolean).join('').toUpperCase() || '?',
          gradeLevel: student.gradeLevel,
          attendancePercent,
          averageGradePercent,
          feeTotalDue,
          feeTotalPaid,
          feeBalance: feeTotalDue - feeTotalPaid,
        };
      }),
    );
  }
}
