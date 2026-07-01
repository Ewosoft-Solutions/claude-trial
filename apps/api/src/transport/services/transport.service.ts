import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../common/database/database.service';
import { TenantDbService } from '../../common/database/tenant-db.service';
import {
  CreateAssignmentDto,
  ListAssignmentsDto,
  UpdateAssignmentDto,
} from '../dto/transport.dto';

const STUDENT_SELECT = {
  id: true,
  studentNumber: true,
  userTenant: {
    select: { user: { select: { firstName: true, lastName: true } } },
  },
} as const;

@Injectable()
export class TransportService {
  constructor(
    private readonly db: DatabaseService,
    private readonly tenantDb: TenantDbService,
  ) {}

  private get client() {
    return this.tenantDb.isScoped ? this.tenantDb.client : this.db.client;
  }

  async listAssignments(tenantId: string, query: ListAssignmentsDto) {
    const where: Record<string, unknown> = { tenantId };
    if (query.status) where['status'] = query.status;
    if (query.routeName) where['routeName'] = query.routeName;
    if (query.query) {
      where['student'] = {
        OR: [
          { studentNumber: { contains: query.query, mode: 'insensitive' } },
          { userTenant: { user: { firstName: { contains: query.query, mode: 'insensitive' } } } },
          { userTenant: { user: { lastName: { contains: query.query, mode: 'insensitive' } } } },
        ],
      };
    }

    return this.client.transportAssignment.findMany({
      where,
      include: { student: { select: STUDENT_SELECT } },
      orderBy: [{ routeName: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async routeSummary(tenantId: string) {
    const assignments = await this.client.transportAssignment.findMany({
      where: { tenantId },
      select: { routeName: true, status: true },
    });

    const routeCounts: Record<string, number> = {};
    const statusCounts: Record<string, number> = {};
    for (const a of assignments) {
      const route = a.routeName ?? 'Unassigned';
      routeCounts[route] = (routeCounts[route] ?? 0) + 1;
      statusCounts[a.status] = (statusCounts[a.status] ?? 0) + 1;
    }

    return {
      totalAssignments: assignments.length,
      routeCounts,
      statusCounts,
    };
  }

  async assignStudent(tenantId: string, dto: CreateAssignmentDto, userId: string) {
    const student = await this.client.student.findFirst({
      where: { id: dto.studentId, tenantId },
    });
    if (!student) throw new NotFoundException('Student not found');

    return this.client.transportAssignment.upsert({
      where: { studentId: dto.studentId },
      update: {
        routeName: dto.routeName ?? null,
        stop: dto.stop ?? null,
        pickupTime: dto.pickupTime ?? null,
        vehicleLabel: dto.vehicleLabel ?? null,
        status: dto.status ?? 'assigned',
        updatedBy: userId,
      },
      create: {
        tenantId,
        studentId: dto.studentId,
        routeName: dto.routeName ?? null,
        stop: dto.stop ?? null,
        pickupTime: dto.pickupTime ?? null,
        vehicleLabel: dto.vehicleLabel ?? null,
        status: dto.status ?? 'assigned',
        createdBy: userId,
        updatedBy: userId,
      },
    });
  }

  async updateAssignment(tenantId: string, id: string, dto: UpdateAssignmentDto, userId: string) {
    const assignment = await this.client.transportAssignment.findFirst({
      where: { id, tenantId },
    });
    if (!assignment) throw new NotFoundException('Assignment not found');

    return this.client.transportAssignment.update({
      where: { id },
      data: {
        ...(dto.routeName !== undefined && { routeName: dto.routeName }),
        ...(dto.stop !== undefined && { stop: dto.stop }),
        ...(dto.pickupTime !== undefined && { pickupTime: dto.pickupTime }),
        ...(dto.vehicleLabel !== undefined && { vehicleLabel: dto.vehicleLabel }),
        ...(dto.status !== undefined && { status: dto.status }),
        updatedBy: userId,
      },
    });
  }
}
