import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../common/database/database.service';
import { TenantDbService } from '../../common/database/tenant-db.service';
import { BulkMarkAttendanceDto, ListAttendanceDto, ATTENDANCE_STATUSES } from '../dto/attendance.dto';

@Injectable()
export class AttendanceService {
  constructor(
    private readonly db: DatabaseService,
    private readonly tenantDb: TenantDbService,
  ) {}

  private get client() {
    return this.tenantDb.isScoped ? this.tenantDb.client : this.db.client;
  }

  async bulkUpsert(tenantId: string, userTenantId: string, dto: BulkMarkAttendanceDto) {
    const { classId, date, records } = dto;

    // Verify class belongs to this tenant
    const cls = await this.client.class.findFirst({ where: { id: classId, tenantId } });
    if (!cls) throw new NotFoundException('Class not found');

    const attendanceDate = new Date(date);

    // Upsert each record using create-or-update on the unique index
    const upserted = await Promise.all(
      records.map((r) =>
        this.client.attendanceRecord.upsert({
          where: {
            tenantId_studentId_classId_date: {
              tenantId,
              studentId: r.studentId,
              classId,
              date: attendanceDate,
            },
          },
          update: {
            status: r.status,
            notes: r.notes ?? null,
            recordedBy: userTenantId,
            updatedBy: userTenantId,
          },
          create: {
            tenantId,
            studentId: r.studentId,
            classId,
            date: attendanceDate,
            status: r.status,
            notes: r.notes ?? null,
            recordedBy: userTenantId,
            createdBy: userTenantId,
            updatedBy: userTenantId,
          },
        }),
      ),
    );

    return { saved: upserted.length, classId, date };
  }

  async list(tenantId: string, query: ListAttendanceDto) {
    const where: Record<string, unknown> = { tenantId };

    if (query.classId) where['classId'] = query.classId;
    if (query.studentId) where['studentId'] = query.studentId;

    if (query.date) {
      where['date'] = new Date(query.date);
    } else if (query.from || query.to) {
      const dateFilter: Record<string, Date> = {};
      if (query.from) dateFilter['gte'] = new Date(query.from);
      if (query.to) dateFilter['lte'] = new Date(query.to);
      where['date'] = dateFilter;
    }

    return this.client.attendanceRecord.findMany({
      where,
      include: {
        student: {
          select: {
            id: true,
            studentNumber: true,
            userTenant: {
              select: { user: { select: { firstName: true, lastName: true } } },
            },
          },
        },
      },
      orderBy: [{ date: 'desc' }, { studentId: 'asc' }],
    });
  }

  async summary(tenantId: string, classId: string, date: string) {
    const records = await this.client.attendanceRecord.findMany({
      where: { tenantId, classId, date: new Date(date) },
      select: { status: true },
    });

    const counts = Object.fromEntries(ATTENDANCE_STATUSES.map((s) => [s, 0])) as Record<string, number>;
    for (const r of records) counts[r.status] = (counts[r.status] ?? 0) + 1;
    return { classId, date, total: records.length, ...counts };
  }
}
