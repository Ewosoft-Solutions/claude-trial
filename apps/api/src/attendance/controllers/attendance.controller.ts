import { Body, Controller, Get, Post, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SwaggerTags } from '../../common/swagger-tags';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../auth/guards/tenant-context.guard';
import { PermissionGuard, RequirePermissions } from '../../auth/guards/permission.guard';
import { TenantScoped } from '../../common/database/rls-tenant.interceptor';
import { AttendanceService } from '../services/attendance.service';
import { BulkMarkAttendanceDto, ListAttendanceDto } from '../dto/attendance.dto';
import type { AuthenticatedRequest } from 'src/auth';

@ApiTags(SwaggerTags.attendance.name)
@Controller('attendance')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
@TenantScoped()
@ApiBearerAuth('JWT-auth')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post('bulk')
  @RequirePermissions(['attendance.mark'])
  @ApiOperation({ summary: 'Bulk upsert attendance for a class on a given date' })
  async bulkMark(@Body() dto: BulkMarkAttendanceDto, @Request() req: AuthenticatedRequest) {
    return this.attendanceService.bulkUpsert(req.user.tenantId, req.user.profileId!, dto);
  }

  @Get()
  @RequirePermissions(['attendance.view'])
  @ApiOperation({ summary: 'List attendance records' })
  async list(@Query() query: ListAttendanceDto, @Request() req: AuthenticatedRequest) {
    return this.attendanceService.list(req.user.tenantId, query);
  }

  @Get('summary')
  @RequirePermissions(['attendance.view'])
  @ApiOperation({ summary: 'Attendance summary for a class on a date' })
  async summary(
    @Query('classId') classId: string,
    @Query('date') date: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.attendanceService.summary(req.user.tenantId, classId, date);
  }
}
