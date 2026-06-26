import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SwaggerTags } from '../../common/swagger-tags';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../auth/guards/tenant-context.guard';
import {
  PermissionGuard,
  RequirePermissions,
} from '../../auth/guards/permission.guard';
import { TenantScoped } from '../../common/database/rls-tenant.interceptor';
import { ReportingAnalyticsService } from '../services/reporting-analytics.service';
import {
  AcademicPerformanceReportDto,
  DashboardQueryDto,
  ExportReportDto,
  ScheduleReportDto,
  CustomReportDto,
} from '../dto';
import type { AuthenticatedRequest } from 'src/auth';

@ApiTags(SwaggerTags.reports.name)
@Controller('reports')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
@TenantScoped()
@ApiBearerAuth('JWT-auth')
export class ReportingController {
  constructor(private readonly reportingService: ReportingAnalyticsService) {}

  @Get('academic-performance')
  @RequirePermissions(['reports.academic'])
  @ApiOperation({ summary: 'Academic performance report (grades aggregate)' })
  async academicPerformance(
    @Query() query: AcademicPerformanceReportDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const user = req.user;
    return this.reportingService.academicPerformance(user.tenantId, query);
  }

  @Get('dashboard')
  @RequirePermissions(['dashboard.view'])
  @ApiOperation({ summary: 'Dashboard metrics snapshot' })
  async dashboard(
    @Query() query: DashboardQueryDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const user = req.user;
    return this.reportingService.dashboard(user.tenantId, query);
  }

  @Post('export')
  @RequirePermissions(['reports.export'])
  @ApiOperation({ summary: 'Export report (queued/stub)' })
  async export(
    @Body() dto: ExportReportDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const user = req.user;
    return this.reportingService.exportReport(user.tenantId, user.userId, dto);
  }

  @Post('schedule')
  @RequirePermissions(['reports.export'])
  @ApiOperation({ summary: 'Schedule report (stub)' })
  async schedule(
    @Body() dto: ScheduleReportDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const user = req.user;
    return this.reportingService.scheduleReport(
      user.tenantId,
      user.userId,
      dto,
    );
  }

  @Post('custom')
  @RequirePermissions(['analytics.advanced'])
  @ApiOperation({ summary: 'Custom report builder (placeholder)' })
  async custom(
    @Body() dto: CustomReportDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const user = req.user;
    return this.reportingService.customReport(user.tenantId, user.userId, dto);
  }
}
