import { Body, Controller, Get, Param, Put, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SwaggerTags } from '../../common/swagger-tags';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../auth/guards/tenant-context.guard';
import { PermissionGuard, RequirePermissions } from '../../auth/guards/permission.guard';
import { TenantScoped } from '../../common/database/rls-tenant.interceptor';
import { HealthService } from '../services/health.service';
import { ListHealthRecordsDto, UpsertHealthRecordDto } from '../dto/health.dto';
import type { AuthenticatedRequest } from 'src/auth';

@ApiTags(SwaggerTags.studentHealth.name)
@Controller('health')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
@TenantScoped()
@ApiBearerAuth('JWT-auth')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('records')
  @RequirePermissions(['health.view'])
  @ApiOperation({ summary: 'List student health records' })
  async listRecords(@Query() query: ListHealthRecordsDto, @Request() req: AuthenticatedRequest) {
    return this.healthService.listRecords(req.user.tenantId, query);
  }

  @Get('records/summary')
  @RequirePermissions(['health.view'])
  @ApiOperation({ summary: 'Triage summary (status counts)' })
  async summary(@Request() req: AuthenticatedRequest) {
    return this.healthService.summary(req.user.tenantId);
  }

  @Put('records/:studentId')
  @RequirePermissions(['health.records'])
  @ApiOperation({ summary: "Create or update a student's health record" })
  async upsertRecord(
    @Param('studentId') studentId: string,
    @Body() dto: UpsertHealthRecordDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.healthService.upsertRecord(req.user.tenantId, studentId, dto, req.user.profileId!);
  }
}
