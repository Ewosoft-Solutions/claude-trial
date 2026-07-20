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

  /**
   * Routes view: assignments folded by routeName into one row per route with
   * rider count, the vehicles/stops seen on it, its pickup window, and a
   * per-status breakdown. Derived from TransportAssignment — no separate route
   * table exists.
   */
  async routes(tenantId: string) {
    const rows = await this.client.transportAssignment.findMany({
      where: { tenantId },
      select: {
        routeName: true,
        stop: true,
        pickupTime: true,
        vehicleLabel: true,
        status: true,
      },
    });

    const map = new Map<
      string,
      {
        routeName: string;
        studentCount: number;
        vehicles: Set<string>;
        stops: Set<string>;
        pickupTimes: string[];
        assigned: number;
        waitlist: number;
        unassigned: number;
      }
    >();

    for (const r of rows) {
      const key = r.routeName ?? 'Unassigned';
      let row = map.get(key);
      if (!row) {
        row = {
          routeName: key,
          studentCount: 0,
          vehicles: new Set(),
          stops: new Set(),
          pickupTimes: [],
          assigned: 0,
          waitlist: 0,
          unassigned: 0,
        };
        map.set(key, row);
      }
      row.studentCount += 1;
      if (r.vehicleLabel) row.vehicles.add(r.vehicleLabel);
      if (r.stop) row.stops.add(r.stop);
      if (r.pickupTime) row.pickupTimes.push(r.pickupTime);
      if (r.status === 'waitlist') row.waitlist += 1;
      else if (r.status === 'unassigned') row.unassigned += 1;
      else row.assigned += 1;
    }

    return Array.from(map.values())
      .map((row) => {
        const times = row.pickupTimes.sort();
        return {
          routeName: row.routeName,
          studentCount: row.studentCount,
          vehicles: Array.from(row.vehicles).sort(),
          stops: Array.from(row.stops).sort(),
          firstPickup: times[0] ?? null,
          lastPickup: times[times.length - 1] ?? null,
          assigned: row.assigned,
          waitlist: row.waitlist,
          unassigned: row.unassigned,
        };
      })
      .sort((a, b) => a.routeName.localeCompare(b.routeName));
  }

  /**
   * Pickups view: the pickup schedule — every assignment that has a pickup time
   * or a stop, with the student, ordered by time then route. Derived from
   * TransportAssignment.
   */
  async pickups(tenantId: string) {
    const rows = await this.client.transportAssignment.findMany({
      where: {
        tenantId,
        OR: [{ pickupTime: { not: null } }, { stop: { not: null } }],
      },
      include: { student: { select: STUDENT_SELECT } },
    });

    return rows
      .map((r) => ({
        id: r.id,
        studentName: `${r.student.userTenant.user.firstName} ${r.student.userTenant.user.lastName}`,
        studentNumber: r.student.studentNumber,
        routeName: r.routeName ?? null,
        stop: r.stop ?? null,
        pickupTime: r.pickupTime ?? null,
        vehicleLabel: r.vehicleLabel ?? null,
        status: r.status,
      }))
      .sort((a, b) => {
        const t = (a.pickupTime ?? '99:99').localeCompare(b.pickupTime ?? '99:99');
        return t !== 0 ? t : (a.routeName ?? '').localeCompare(b.routeName ?? '');
      });
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
