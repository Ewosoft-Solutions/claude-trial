import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../common/database/database.service';
import { TenantDbService } from '../../common/database/tenant-db.service';

/**
 * Overview Service
 *
 * Real, tenant-scoped aggregates that power the /overview dashboards. Every
 * figure is derived from live data filtered by `tenantId` (and, for personal
 * blocks, the caller's profile), so a freshly onboarded school reports zeros
 * rather than fabricated numbers.
 */
@Injectable()
export class OverviewService {
  constructor(
    private readonly db: DatabaseService,
    private readonly tenantDb: TenantDbService,
  ) {}

  /** Scoped app_runtime client inside a @TenantScoped request; else privileged. */
  private get client() {
    return this.tenantDb.isScoped ? this.tenantDb.client : this.db.client;
  }

  /**
   * Aggregate the stats the dashboards need.
   *
   * @param tenantId  - the active tenant
   * @param profileId - the caller's active profile (for personal blocks)
   */
  async getStats(tenantId: string, profileId?: string) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      students,
      staff,
      classes,
      upcomingEvents,
      admissionsPending,
      outstanding,
      revenueAgg,
      attendanceTotal,
      attendancePresent,
      announcements,
      pendingInvitations,
      // personal
      myClasses,
      myChildren,
      studentRecord,
    ] = await Promise.all([
      this.client.student.count({
        where: { tenantId, enrollmentStatus: 'active' },
      }),
      this.client.userTenant.count({
        where: {
          tenantId,
          status: 'active',
          userTenantRole: { role: { clearanceLevel: { gte: 3, lte: 8 } } },
        },
      }),
      this.client.class.count({ where: { tenantId } }),
      this.client.schoolEvent.count({
        where: {
          tenantId,
          startDate: { gte: now },
          status: { in: ['scheduled', 'ongoing'] },
        },
      }),
      this.client.admissionApplication.count({
        where: { tenantId, decision: 'pending' },
      }),
      this.client.feeInvoice.aggregate({
        _sum: { amountDue: true, amountPaid: true },
        _count: true,
        where: { tenantId, status: { in: ['issued', 'partial', 'overdue'] } },
      }),
      this.client.payment.aggregate({
        _sum: { amount: true },
        where: { tenantId, status: 'completed', paidAt: { gte: startOfMonth } },
      }),
      this.client.attendanceRecord.count({ where: { tenantId } }),
      this.client.attendanceRecord.count({
        where: { tenantId, status: 'present' },
      }),
      this.client.announcement.count({ where: { tenantId } }),
      this.client.userTenant.count({
        where: { tenantId, invitationToken: { not: null }, status: 'pending' },
      }),
      // personal — teacher: active class assignments for this profile
      profileId
        ? this.client.classTeacher.count({
            where: { tenantId, userTenantId: profileId, unassignedAt: null },
          })
        : Promise.resolve(0),
      // personal — parent: children linked to this profile
      profileId
        ? this.client.studentGuardian.count({
            where: { tenantId, userTenantId: profileId },
          })
        : Promise.resolve(0),
      // personal — student: this profile's student record (for enrolments)
      profileId
        ? this.client.student.findFirst({
            where: { tenantId, userTenantId: profileId },
            select: { id: true },
          })
        : Promise.resolve(null),
    ]);

    const outstandingAmount =
      (outstanding._sum.amountDue ?? 0) - (outstanding._sum.amountPaid ?? 0);

    let myEnrollments = 0;
    if (studentRecord) {
      myEnrollments = await this.client.enrollment.count({
        where: { studentId: studentRecord.id, status: 'active' },
      });
    }

    const attendanceRate =
      attendanceTotal > 0
        ? Math.round((attendancePresent / attendanceTotal) * 100)
        : null;

    return {
      school: {
        students,
        staff,
        classes,
        upcomingEvents,
        admissionsPending,
        announcements,
        pendingInvitations,
        attendanceRate, // percent or null when no records yet
        finance: {
          revenueThisMonth: revenueAgg._sum.amount ?? 0, // minor units (kobo)
          outstandingAmount: outstandingAmount > 0 ? outstandingAmount : 0,
          outstandingInvoices: outstanding._count ?? 0,
        },
      },
      personal: {
        myClasses,
        myChildren,
        myEnrollments,
      },
    };
  }
}
