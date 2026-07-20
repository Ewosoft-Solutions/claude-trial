import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../common/database/database.service';
import { TenantDbService } from '../../common/database/tenant-db.service';
import { ListHealthRecordsDto, UpsertHealthRecordDto } from '../dto/health.dto';

const STUDENT_SELECT = {
  id: true,
  studentNumber: true,
  userTenant: {
    select: { user: { select: { firstName: true, lastName: true } } },
  },
} as const;

@Injectable()
export class HealthService {
  constructor(
    private readonly db: DatabaseService,
    private readonly tenantDb: TenantDbService,
  ) {}

  private get client() {
    return this.tenantDb.isScoped ? this.tenantDb.client : this.db.client;
  }

  async listRecords(tenantId: string, query: ListHealthRecordsDto) {
    const where: Record<string, unknown> = { tenantId };
    if (query.status) where['status'] = query.status;
    if (query.query) {
      where['student'] = {
        OR: [
          { studentNumber: { contains: query.query, mode: 'insensitive' } },
          { userTenant: { user: { firstName: { contains: query.query, mode: 'insensitive' } } } },
          { userTenant: { user: { lastName: { contains: query.query, mode: 'insensitive' } } } },
        ],
      };
    }

    return this.client.healthRecord.findMany({
      where,
      include: { student: { select: STUDENT_SELECT } },
      orderBy: [{ status: 'desc' }, { updatedAt: 'desc' }],
    });
  }

  async summary(tenantId: string) {
    const records = await this.client.healthRecord.findMany({
      where: { tenantId },
      select: { status: true },
    });

    const statusCounts: Record<string, number> = {};
    for (const r of records) statusCounts[r.status] = (statusCounts[r.status] ?? 0) + 1;
    return { totalRecords: records.length, statusCounts };
  }

  async upsertRecord(
    tenantId: string,
    studentId: string,
    dto: UpsertHealthRecordDto,
    userId: string,
  ) {
    const student = await this.client.student.findFirst({ where: { id: studentId, tenantId } });
    if (!student) throw new NotFoundException('Student not found');

    return this.client.healthRecord.upsert({
      where: { studentId },
      update: {
        ...(dto.bloodType !== undefined && { bloodType: dto.bloodType }),
        ...(dto.allergies !== undefined && { allergies: dto.allergies }),
        ...(dto.conditions !== undefined && { conditions: dto.conditions }),
        ...(dto.medications !== undefined && { medications: dto.medications }),
        ...(dto.emergencyContactName !== undefined && { emergencyContactName: dto.emergencyContactName }),
        ...(dto.emergencyContactPhone !== undefined && { emergencyContactPhone: dto.emergencyContactPhone }),
        ...(dto.lastCheckup !== undefined && { lastCheckup: new Date(dto.lastCheckup) }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        updatedBy: userId,
      },
      create: {
        tenantId,
        studentId,
        bloodType: dto.bloodType ?? null,
        allergies: dto.allergies ?? null,
        conditions: dto.conditions ?? null,
        medications: dto.medications ?? null,
        emergencyContactName: dto.emergencyContactName ?? null,
        emergencyContactPhone: dto.emergencyContactPhone ?? null,
        lastCheckup: dto.lastCheckup ? new Date(dto.lastCheckup) : null,
        status: dto.status ?? 'normal',
        notes: dto.notes ?? null,
        createdBy: userId,
        updatedBy: userId,
      },
    });
  }
}
