/**
 * Analytics tool permission matrix (Step 6 hardening).
 */
import { AnalyticsToolsService } from './analytics-tools.service';

function buildService() {
  return new AnalyticsToolsService(
    { list: jest.fn() } as never,
    { listEvents: jest.fn() } as never,
    { invoiceSummary: jest.fn() } as never,
    { getMyChildren: jest.fn() } as never,
    {
      dashboard: jest.fn(),
      academicPerformance: jest.fn(),
    } as never,
    { list: jest.fn() } as never,
  );
}

describe('AnalyticsToolsService permission matrix', () => {
  it('declares the expected permission and clearance floor for every tool', () => {
    const service = buildService();

    expect(
      Object.fromEntries(
        service.list().map((tool) => [
          tool.definition.name,
          {
            permission: tool.requiredPermission,
            minClearance: tool.minClearance,
          },
        ]),
      ),
    ).toEqual({
      get_enrollment_stats: {
        permission: 'reports.view',
        minClearance: 3,
      },
      get_attendance_summary: {
        permission: 'attendance.view',
        minClearance: 3,
      },
      get_academic_performance: {
        permission: 'reports.academic',
        minClearance: 3,
      },
      get_finance_summary: {
        permission: 'financial_reports.view',
        minClearance: 5,
      },
      get_student_overview: {
        permission: 'students.view.own',
        minClearance: 1,
      },
      get_upcoming_events: {
        permission: 'events.view',
        minClearance: 1,
      },
    });
  });

  it('keeps tool input schemas closed to extra model-supplied parameters', () => {
    const service = buildService();

    expect(service.list()).toHaveLength(6);
    for (const tool of service.list()) {
      expect(tool.definition.inputSchema).toMatchObject({
        type: 'object',
        additionalProperties: false,
      });
      expect(tool.requiredPermission).toMatch(/^[a-z_.]+$/);
      expect(tool.minClearance).toBeGreaterThanOrEqual(1);
      expect(tool.minClearance).toBeLessThanOrEqual(10);
    }
  });
});
