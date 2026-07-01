import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../common/database/database.service';
import { TenantDbService } from '../../common/database/tenant-db.service';
import { CreatePayrollRecordDto, ListPayrollRecordsDto, UpdatePayrollRecordDto } from '../dto/hr.dto';

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
    const where: Record<string, unknown> = { tenantId };
    if (query.status) where['status'] = query.status;
    if (query.payPeriod) where['payPeriod'] = query.payPeriod;
    if (query.query) {
      where['staffName'] = { contains: query.query, mode: 'insensitive' };
    }

    return this.client.staffPayrollRecord.findMany({
      where,
      orderBy: [{ payPeriod: 'desc' }, { staffName: 'asc' }],
    });
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

  async createRecord(tenantId: string, dto: CreatePayrollRecordDto, userId: string) {
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

  async updateRecord(tenantId: string, id: string, dto: UpdatePayrollRecordDto, userId: string) {
    const record = await this.client.staffPayrollRecord.findFirst({ where: { id, tenantId } });
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
}
