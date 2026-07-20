import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../common/database/database.service';
import { TenantDbService } from '../../common/database/tenant-db.service';
import {
  CreateApplicationDto,
  ListApplicationsDto,
  UpdateApplicationDto,
} from '../dto/admissions.dto';

@Injectable()
export class AdmissionsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly tenantDb: TenantDbService,
  ) {}

  private get client() {
    return this.tenantDb.isScoped ? this.tenantDb.client : this.db.client;
  }

  async listApplications(tenantId: string, query: ListApplicationsDto) {
    const where: Record<string, unknown> = { tenantId };
    if (query.stage) where['stage'] = query.stage;
    if (query.decision) where['decision'] = query.decision;
    if (query.applyingFor) where['applyingFor'] = query.applyingFor;
    if (query.query) {
      where['OR'] = [
        { applicantName: { contains: query.query, mode: 'insensitive' } },
        { guardianName: { contains: query.query, mode: 'insensitive' } },
      ];
    }

    return this.client.admissionApplication.findMany({
      where,
      orderBy: [{ submittedDate: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async getApplication(tenantId: string, id: string) {
    const application = await this.client.admissionApplication.findFirst({
      where: { id, tenantId },
    });
    if (!application) throw new NotFoundException('Application not found');
    return application;
  }

  async createApplication(tenantId: string, dto: CreateApplicationDto, userId: string) {
    return this.client.admissionApplication.create({
      data: {
        tenantId,
        applicantName: dto.applicantName,
        applyingFor: dto.applyingFor,
        guardianName: dto.guardianName,
        guardianEmail: dto.guardianEmail ?? null,
        guardianPhone: dto.guardianPhone ?? null,
        submittedDate: dto.submittedDate ? new Date(dto.submittedDate) : new Date(),
        stage: 'application',
        decision: 'pending',
        notes: dto.notes ?? null,
        createdBy: userId,
        updatedBy: userId,
      },
    });
  }

  async updateApplication(
    tenantId: string,
    id: string,
    dto: UpdateApplicationDto,
    userId: string,
  ) {
    const application = await this.client.admissionApplication.findFirst({
      where: { id, tenantId },
    });
    if (!application) throw new NotFoundException('Application not found');

    return this.client.admissionApplication.update({
      where: { id },
      data: {
        ...(dto.stage !== undefined && { stage: dto.stage }),
        ...(dto.decision !== undefined && { decision: dto.decision }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        updatedBy: userId,
      },
    });
  }

  async pipelineSummary(tenantId: string) {
    const applications = await this.client.admissionApplication.findMany({
      where: { tenantId },
      select: { stage: true, decision: true },
    });

    const stageCounts: Record<string, number> = {};
    const decisionCounts: Record<string, number> = {};
    for (const app of applications) {
      stageCounts[app.stage] = (stageCounts[app.stage] ?? 0) + 1;
      decisionCounts[app.decision] = (decisionCounts[app.decision] ?? 0) + 1;
    }

    return {
      totalApplications: applications.length,
      stageCounts,
      decisionCounts,
    };
  }
}
