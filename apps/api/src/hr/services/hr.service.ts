import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@workspace/database';
import { DatabaseService } from '../../common/database/database.service';
import { TenantDbService } from '../../common/database/tenant-db.service';
import { resolvePaginationOrderBy, type SortAllowList } from '../../common/dto';
import {
  CreateLeaveRequestDto,
  CreatePayrollRecordDto,
  ListLeaveRequestsDto,
  ListPayrollRecordsDto,
  ReviewLeaveRequestDto,
  UpdatePayrollRecordDto,
} from '../dto/hr.dto';

/** Allow-listed sort columns for the payroll list; default is newest period then staff A–Z. */
const PAYROLL_LIST_SORT: SortAllowList<Prisma.StaffPayrollRecordOrderByWithRelationInput> =
  {
    staffName: (dir) => [{ staffName: dir }],
    payPeriod: (dir) => [{ payPeriod: dir }, { staffName: 'asc' }],
    status: (dir) => [{ status: dir }, { staffName: 'asc' }],
    grossPay: (dir) => [{ grossPay: dir }],
    netPay: (dir) => [{ netPay: dir }],
  };

@Injectable()
export class HrService {
  constructor(
    private readonly db: DatabaseService,
    private readonly tenantDb: TenantDbService,
  ) {}

  private get client() {
    return this.tenantDb.isScoped ? this.tenantDb.client : this.db.client;
  }

  async listPayrollRecords(tenantId: string, query: ListPayrollRecordsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { tenantId };
    if (query.status) where['status'] = query.status;
    if (query.payPeriod) where['payPeriod'] = query.payPeriod;
    if (query.search) {
      where['staffName'] = { contains: query.search, mode: 'insensitive' };
    }

    const [data, total] = await Promise.all([
      this.client.staffPayrollRecord.findMany({
        where,
        orderBy: resolvePaginationOrderBy(
          query.sortBy,
          query.sortOrder,
          PAYROLL_LIST_SORT,
          [{ payPeriod: 'desc' }, { staffName: 'asc' }],
        ),
        skip,
        take: limit,
      }),
      this.client.staffPayrollRecord.count({ where }),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  }

  async payrollSummary(tenantId: string, payPeriod?: string) {
    const where: Record<string, unknown> = { tenantId };
    if (payPeriod) where['payPeriod'] = payPeriod;

    const records = await this.client.staffPayrollRecord.findMany({
      where,
      select: { status: true, grossPay: true, netPay: true },
    });

    const statusCounts: Record<string, number> = {};
    let totalGross = 0;
    let totalNet = 0;
    for (const r of records) {
      statusCounts[r.status] = (statusCounts[r.status] ?? 0) + 1;
      totalGross += Number(r.grossPay);
      totalNet += Number(r.netPay);
    }

    return { totalRecords: records.length, statusCounts, totalGross, totalNet };
  }

  /**
   * Staff directory: one row per distinct staff member seen in payroll, with
   * their latest role snapshot and most recent pay period. Derived from
   * StaffPayrollRecord — there is no dedicated employee table, so payroll is
   * the authoritative roster of paid staff.
   */
  async directory(tenantId: string) {
    const records = await this.client.staffPayrollRecord.findMany({
      where: { tenantId },
      select: {
        staffUserTenantId: true,
        staffName: true,
        role: true,
        payPeriod: true,
        status: true,
      },
      orderBy: { payPeriod: 'desc' },
    });

    const byStaff = new Map<
      string,
      {
        staffUserTenantId: string;
        staffName: string;
        role: string | null;
        latestPayPeriod: string;
        latestStatus: string;
        recordCount: number;
      }
    >();

    for (const r of records) {
      const existing = byStaff.get(r.staffUserTenantId);
      if (!existing) {
        // First (most recent, since ordered desc) wins for the snapshot fields.
        byStaff.set(r.staffUserTenantId, {
          staffUserTenantId: r.staffUserTenantId,
          staffName: r.staffName,
          role: r.role ?? null,
          latestPayPeriod: r.payPeriod,
          latestStatus: r.status,
          recordCount: 1,
        });
      } else {
        existing.recordCount += 1;
      }
    }

    return Array.from(byStaff.values()).sort((a, b) =>
      a.staffName.localeCompare(b.staffName),
    );
  }

  async createRecord(
    tenantId: string,
    dto: CreatePayrollRecordDto,
    userId: string,
  ) {
    const deductions = dto.deductions ?? 0;
    return this.client.staffPayrollRecord.create({
      data: {
        tenantId,
        staffUserTenantId: dto.staffUserTenantId,
        staffName: dto.staffName,
        role: dto.role ?? null,
        payPeriod: dto.payPeriod,
        grossPay: dto.grossPay,
        deductions,
        netPay: dto.grossPay - deductions,
        status: 'draft',
        createdBy: userId,
        updatedBy: userId,
      },
    });
  }

  async updateRecord(
    tenantId: string,
    id: string,
    dto: UpdatePayrollRecordDto,
    userId: string,
  ) {
    const record = await this.client.staffPayrollRecord.findFirst({
      where: { id, tenantId },
    });
    if (!record) throw new NotFoundException('Payroll record not found');

    return this.client.staffPayrollRecord.update({
      where: { id },
      data: {
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.paidDate !== undefined && { paidDate: new Date(dto.paidDate) }),
        updatedBy: userId,
      },
    });
  }

  // ---- Leave ----------------------------------------------------------

  async listLeaveRequests(tenantId: string, query: ListLeaveRequestsDto) {
    const where: Record<string, unknown> = { tenantId };
    if (query.status) where['status'] = query.status;
    if (query.query) {
      where['staffName'] = { contains: query.query, mode: 'insensitive' };
    }

    return this.client.staffLeaveRequest.findMany({
      where,
      orderBy: [{ startDate: 'desc' }, { staffName: 'asc' }],
    });
  }

  async createLeaveRequest(
    tenantId: string,
    dto: CreateLeaveRequestDto,
    userId: string,
  ) {
    return this.client.staffLeaveRequest.create({
      data: {
        tenantId,
        staffUserTenantId: dto.staffUserTenantId,
        staffName: dto.staffName,
        leaveType: dto.leaveType,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        days: dto.days,
        reason: dto.reason ?? null,
        status: 'pending',
        createdBy: userId,
        updatedBy: userId,
      },
    });
  }

  async reviewLeaveRequest(
    tenantId: string,
    id: string,
    dto: ReviewLeaveRequestDto,
    userId: string,
  ) {
    const request = await this.client.staffLeaveRequest.findFirst({
      where: { id, tenantId },
    });
    if (!request) throw new NotFoundException('Leave request not found');

    return this.client.staffLeaveRequest.update({
      where: { id },
      data: {
        status: dto.status,
        reviewNote: dto.reviewNote ?? null,
        reviewedBy: userId,
        updatedBy: userId,
      },
    });
  }
}
