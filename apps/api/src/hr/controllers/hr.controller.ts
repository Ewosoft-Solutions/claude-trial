import { Body, Controller, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SwaggerTags } from '../../common/swagger-tags';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../auth/guards/tenant-context.guard';
import { PermissionGuard, RequirePermissions } from '../../auth/guards/permission.guard';
import { TenantScoped } from '../../common/database/rls-tenant.interceptor';
import { HrService } from '../services/hr.service';
import { CreatePayrollRecordDto, ListPayrollRecordsDto, UpdatePayrollRecordDto } from '../dto/hr.dto';
import type { AuthenticatedRequest } from 'src/auth';

@ApiTags(SwaggerTags.hr.name)
@Controller('hr')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
@TenantScoped()
@ApiBearerAuth('JWT-auth')
export class HrController {
  constructor(private readonly hrService: HrService) {}

  @Get('payroll')
  @RequirePermissions(['payroll.view'])
  @ApiOperation({ summary: 'List payroll records' })
  async listPayrollRecords(@Query() query: ListPayrollRecordsDto, @Request() req: AuthenticatedRequest) {
    return this.hrService.listPayrollRecords(req.user.tenantId, query);
  }

  @Get('payroll/summary')
  @RequirePermissions(['payroll.view'])
  @ApiOperation({ summary: 'Payroll summary (status counts + totals)' })
  async payrollSummary(
    @Query('payPeriod') payPeriod: string | undefined,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.hrService.payrollSummary(req.user.tenantId, payPeriod);
  }

  @Post('payroll')
  @RequirePermissions(['payroll.process'])
  @ApiOperation({ summary: 'Create a payroll record for a staff member' })
  async createRecord(@Body() dto: CreatePayrollRecordDto, @Request() req: AuthenticatedRequest) {
    return this.hrService.createRecord(req.user.tenantId, dto, req.user.profileId!);
  }

  @Patch('payroll/:id')
  @RequirePermissions(['payroll.process'])
  @ApiOperation({ summary: 'Approve/mark a payroll record as paid' })
  async updateRecord(
    @Param('id') id: string,
    @Body() dto: UpdatePayrollRecordDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.hrService.updateRecord(req.user.tenantId, id, dto, req.user.profileId!);
  }
}
