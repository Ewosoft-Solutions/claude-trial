/**
 * Analytics AI tool set v1 (Step 2, docs/ai-integration-plan.md).
 *
 * Six read-only tools over real school data. Every tool delegates to an
 * existing NestJS read service (RLS + tenantId-scoped) and does at most
 * light aggregation over the service's output — no raw SQL, no new query
 * paths. Permission names must exist in the seed catalog.
 */
import { Injectable } from '@nestjs/common';
import { AttendanceService } from '../../attendance/services/attendance.service';
import { EventsService } from '../../events/services/events.service';
import { FinanceService } from '../../finance/services/finance.service';
import { ParentPortalService } from '../../parent-portal/services/parent-portal.service';
import { ReportingAnalyticsService } from '../../reporting-analytics/services/reporting-analytics.service';
import { StudentService } from '../../student/services/student.service';
import { STUDENT_ENROLLMENT_STATUSES } from '../../student/dto/student.dto';
import type { AnalyticsTool } from './analytics-tool.types';

@Injectable()
export class AnalyticsToolsService {
  private readonly tools: AnalyticsTool[];

  constructor(
    private readonly attendanceService: AttendanceService,
    private readonly eventsService: EventsService,
    private readonly financeService: FinanceService,
    private readonly parentPortalService: ParentPortalService,
    private readonly reportingAnalyticsService: ReportingAnalyticsService,
    private readonly studentService: StudentService,
  ) {
    this.tools = [
      this.enrollmentStats(),
      this.attendanceSummary(),
      this.academicPerformance(),
      this.financeSummary(),
      this.studentOverview(),
      this.upcomingEvents(),
    ];
  }

  list(): AnalyticsTool[] {
    return this.tools;
  }

  get(name: string): AnalyticsTool | undefined {
    return this.tools.find((tool) => tool.definition.name === name);
  }

  private enrollmentStats(): AnalyticsTool {
    return {
      requiredPermission: 'reports.view',
      minClearance: 3,
      definition: {
        name: 'get_enrollment_stats',
        description:
          'School-wide enrollment statistics: total students, classes, ' +
          'assessments, and student counts per enrollment status ' +
          '(active, inactive, suspended, graduated, transferred, withdrawn). ' +
          'Call this for questions about how many students are enrolled or ' +
          'the overall size of the school. Optionally filter the per-status ' +
          'counts to one grade level.',
        inputSchema: {
          type: 'object',
          properties: {
            gradeLevel: {
              type: 'string',
              description:
                'Optional grade level to restrict the per-status counts to.',
            },
          },
          additionalProperties: false,
        },
      },
      execute: async (context, input) => {
        const gradeLevel =
          typeof input.gradeLevel === 'string' ? input.gradeLevel : undefined;

        const [dashboard, statusCounts] = await Promise.all([
          this.reportingAnalyticsService.dashboard(context.tenantId, {}),
          Promise.all(
            STUDENT_ENROLLMENT_STATUSES.map(async (status) => {
              const page = await this.studentService.list(context.tenantId, {
                enrollmentStatus: status,
                gradeLevel,
                page: 1,
                limit: 1,
              });
              return [status, page.pagination.total] as const;
            }),
          ),
        ]);

        return {
          totals: dashboard,
          studentsByEnrollmentStatus: Object.fromEntries(statusCounts),
          ...(gradeLevel ? { gradeLevel } : {}),
        };
      },
    };
  }

  private attendanceSummary(): AnalyticsTool {
    return {
      requiredPermission: 'attendance.view',
      minClearance: 3,
      definition: {
        name: 'get_attendance_summary',
        description:
          'Attendance summary over a date range: total records, counts per ' +
          'status (present, absent, late, excused), and attendance rate. ' +
          'Call this for questions about attendance levels or absences. ' +
          'Optionally filter by class or student, and always pass from/to ' +
          'dates when the user names a period.',
        inputSchema: {
          type: 'object',
          properties: {
            from: {
              type: 'string',
              description: 'Start date (YYYY-MM-DD), inclusive.',
            },
            to: {
              type: 'string',
              description: 'End date (YYYY-MM-DD), inclusive.',
            },
            classId: { type: 'string', description: 'Optional class id.' },
            studentId: { type: 'string', description: 'Optional student id.' },
          },
          additionalProperties: false,
        },
      },
      execute: async (context, input) => {
        const records = await this.attendanceService.list(context.tenantId, {
          from: typeof input.from === 'string' ? input.from : undefined,
          to: typeof input.to === 'string' ? input.to : undefined,
          classId: typeof input.classId === 'string' ? input.classId : undefined,
          studentId:
            typeof input.studentId === 'string' ? input.studentId : undefined,
        });

        const statusCounts: Record<string, number> = {};
        for (const record of records) {
          statusCounts[record.status] = (statusCounts[record.status] ?? 0) + 1;
        }
        const total = records.length;
        const present = statusCounts['present'] ?? 0;

        return {
          totalRecords: total,
          statusCounts,
          attendanceRatePercent:
            total > 0 ? Math.round((present / total) * 100) : null,
        };
      },
    };
  }

  private academicPerformance(): AnalyticsTool {
    return {
      requiredPermission: 'reports.academic',
      minClearance: 3,
      definition: {
        name: 'get_academic_performance',
        description:
          'Academic performance aggregates: average percentages and points ' +
          'per assessment plus an overall average. Call this for questions ' +
          'about grades, results, or how students are performing. Optionally ' +
          'filter by class, assessment, academic year, or term.',
        inputSchema: {
          type: 'object',
          properties: {
            classId: { type: 'string', description: 'Optional class id.' },
            assessmentId: {
              type: 'string',
              description: 'Optional assessment id.',
            },
            academicYearId: {
              type: 'string',
              description: 'Optional academic year id.',
            },
            termId: { type: 'string', description: 'Optional term id.' },
          },
          additionalProperties: false,
        },
      },
      execute: (context, input) =>
        this.reportingAnalyticsService.academicPerformance(context.tenantId, {
          classId: typeof input.classId === 'string' ? input.classId : undefined,
          assessmentId:
            typeof input.assessmentId === 'string'
              ? input.assessmentId
              : undefined,
          academicYearId:
            typeof input.academicYearId === 'string'
              ? input.academicYearId
              : undefined,
          termId: typeof input.termId === 'string' ? input.termId : undefined,
        }),
    };
  }

  private financeSummary(): AnalyticsTool {
    return {
      requiredPermission: 'financial_reports.view',
      minClearance: 5,
      definition: {
        name: 'get_finance_summary',
        description:
          'Fee/finance summary: total invoices, amounts billed, collected, ' +
          'and outstanding (minor currency units), plus invoice status ' +
          'counts. Call this for questions about fees, revenue, payments, or ' +
          'outstanding balances. Optionally filter by term name.',
        inputSchema: {
          type: 'object',
          properties: {
            termName: {
              type: 'string',
              description: 'Optional term name to filter invoices by.',
            },
          },
          additionalProperties: false,
        },
      },
      execute: (context, input) =>
        this.financeService.invoiceSummary(
          context.tenantId,
          typeof input.termName === 'string' ? input.termName : undefined,
        ),
    };
  }

  private studentOverview(): AnalyticsTool {
    return {
      requiredPermission: 'students.view.own',
      minClearance: 1,
      definition: {
        name: 'get_student_overview',
        description:
          'Overview of the students linked to the CALLING user as their ' +
          'guardian (their own children): name, grade level, attendance ' +
          'percentage, average grade, and fee balance per child. Call this ' +
          'when a parent asks how their child/children are doing. Returns ' +
          'only the caller’s own children — never another family’s data.',
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
      },
      execute: (context) =>
        this.parentPortalService.getMyChildren(
          context.tenantId,
          context.profileId,
        ),
    };
  }

  private upcomingEvents(): AnalyticsTool {
    return {
      requiredPermission: 'events.view',
      minClearance: 1,
      definition: {
        name: 'get_upcoming_events',
        description:
          'Upcoming school events (title, type, status, start/end dates), ' +
          'soonest first. Call this for questions about what is happening at ' +
          'school, event schedules, or important dates.',
        inputSchema: {
          type: 'object',
          properties: {
            limit: {
              type: 'integer',
              description: 'Max events to return (default 10, max 25).',
            },
          },
          additionalProperties: false,
        },
      },
      execute: async (context, input) => {
        const rawLimit = typeof input.limit === 'number' ? input.limit : 10;
        const limit = Math.min(Math.max(Math.trunc(rawLimit), 1), 25);

        const events = await this.eventsService.listEvents(
          context.tenantId,
          {},
        );
        const now = new Date();

        return events
          .filter((event) => event.startDate >= now)
          .slice(0, limit)
          .map((event) => ({
            id: event.id,
            title: event.title,
            eventType: event.eventType,
            status: event.status,
            startDate: event.startDate,
            endDate: event.endDate,
          }));
      },
    };
  }
}
