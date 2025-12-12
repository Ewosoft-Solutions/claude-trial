import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../common/database/database.service';
import {
  AcademicPerformanceReportDto,
  DashboardQueryDto,
  ExportReportDto,
  ScheduleReportDto,
  CustomReportDto,
} from '../dto';

@Injectable()
export class ReportingAnalyticsService {
  constructor(private readonly db: DatabaseService) {}

  // Academic performance: aggregates grades by class/assessment
  async academicPerformance(tenantId: string, dto: AcademicPerformanceReportDto) {
    const where: any = {
      assessment: {
        academicYear: { tenantId },
      },
    };
    if (dto.classId) where.assessment = { ...where.assessment, classId: dto.classId };
    if (dto.assessmentId) where.assessmentId = dto.assessmentId;
    if (dto.academicYearId)
      where.assessment = { ...where.assessment, academicYearId: dto.academicYearId };
    if (dto.termId) where.assessment = { ...where.assessment, termId: dto.termId };

    const grades = await this.db.client.grade.findMany({
      where,
      include: {
        assessment: {
          select: {
            id: true,
            name: true,
            classId: true,
            termId: true,
            academicYearId: true,
            maxPoints: true,
            weight: true,
          },
        },
      },
    });

    if (grades.length === 0) {
      return { data: [], summary: { count: 0 } };
    }

    // Aggregate by assessment
    const byAssessment = new Map<
      string,
      {
        assessmentId: string;
        name: string;
        classId: string;
        termId: string;
        academicYearId: string;
        avgPercentage?: number;
        avgPoints?: number;
        count: number;
      }
    >();

    for (const g of grades) {
      const key = g.assessmentId;
      const entry = byAssessment.get(key) ?? {
        assessmentId: g.assessmentId,
        name: g.assessment.name,
        classId: g.assessment.classId,
        termId: g.assessment.termId,
        academicYearId: g.assessment.academicYearId,
        avgPercentage: 0,
        avgPoints: 0,
        count: 0,
      };
      const pct = g.percentage ? Number(g.percentage) : undefined;
      const pts = g.pointsEarned ? Number(g.pointsEarned) : undefined;
      if (pct !== undefined) entry.avgPercentage = (entry.avgPercentage ?? 0) + pct;
      if (pts !== undefined) entry.avgPoints = (entry.avgPoints ?? 0) + pts;
      entry.count += 1;
      byAssessment.set(key, entry);
    }

    const data = Array.from(byAssessment.values()).map((v) => ({
      ...v,
      avgPercentage: v.avgPercentage !== undefined ? v.avgPercentage / v.count : undefined,
      avgPoints: v.avgPoints !== undefined ? v.avgPoints / v.count : undefined,
    }));

    // Overall summary
    const totalCount = grades.length;
    const pctValues = grades
      .map((g) => (g.percentage === null ? undefined : Number(g.percentage)))
      .filter((v): v is number => v !== undefined);
    const avgPercentage =
      pctValues.length > 0 ? pctValues.reduce((a, b) => a + b, 0) / pctValues.length : undefined;

    return {
      data,
      summary: {
        count: totalCount,
        avgPercentage,
      },
    };
  }

  // Dashboard metrics snapshot
  async dashboard(tenantId: string, dto: DashboardQueryDto) {
    const [students, classes, assessments, messages, announcements] = await Promise.all([
      this.db.client.student.count({ where: { tenantId } }),
      this.db.client.class.count({ where: { academicYear: { tenantId } } }),
      this.db.client.assessment.count({
        where: {
          academicYear: { tenantId },
          academicYearId: dto.academicYearId ?? undefined,
        },
      }),
      this.db.client.message.count({ where: { tenantId } }),
      this.db.client.announcement.count({ where: { tenantId } }),
    ]);

    return {
      students,
      classes,
      assessments,
      messages,
      announcements,
    };
  }

  // Export stub (would enqueue job)
  async exportReport(tenantId: string, userId: string, dto: ExportReportDto) {
    return {
      status: 'queued',
      reportType: dto.reportType,
      format: dto.format,
      params: dto.params ?? {},
      requestedBy: userId,
      tenantId,
    };
  }

  // Schedule stub (would create cron job)
  async scheduleReport(tenantId: string, userId: string, dto: ScheduleReportDto) {
    return {
      status: 'scheduled',
      schedule: dto.schedule,
      reportType: dto.reportType,
      format: dto.format ?? 'pdf',
      params: dto.params ?? {},
      recipients: dto.recipients ?? [],
      tenantId,
      createdBy: userId,
    };
  }

  // Custom report stub (placeholder for builder)
  async customReport(tenantId: string, userId: string, dto: CustomReportDto) {
    // For now return request echo; in future, run dynamic query
    return {
      name: dto.name,
      description: dto.description,
      source: dto.source,
      filters: dto.filters ?? {},
      fields: dto.fields ?? [],
      tenantId,
      requestedBy: userId,
      data: [],
      note: 'Custom report execution placeholder',
    };
  }
}

