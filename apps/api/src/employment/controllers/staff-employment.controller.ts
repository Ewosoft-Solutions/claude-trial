import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../auth/guards/tenant-context.guard';
import {
  PermissionGuard,
  RequirePermissions,
} from '../../auth/guards/permission.guard';
import { TenantScoped } from '../../common/database/rls-tenant.interceptor';
import type { AuthenticatedRequest } from '../../auth/middleware/multi-layer-security.middleware';
import { StaffEmploymentService } from '../services/staff-employment.service';
import {
  AddQualificationDto,
  CreateEmploymentDto,
  DisableEmploymentDto,
  UpdateEmploymentDto,
} from '../dto/employment.dto';

/**
 * Staff employment (WB1-2). First-class HR records for a person, consumed by the
 * People workbench. Reading needs `staff.view`; creating an employment needs
 * `staff.create`; edits/disable/qualifications need `staff.edit`; removing a
 * qualification needs `staff.delete`. All routes are authenticated,
 * tenant-context-guarded, and RLS-scoped; enforcement is server-side.
 */
@ApiTags('People')
@Controller('directory/people/:personId/employment')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
@TenantScoped()
@ApiBearerAuth('JWT-auth')
export class StaffEmploymentController {
  constructor(private readonly employment: StaffEmploymentService) {}

  private ctx(req: AuthenticatedRequest) {
    if (!req.user) throw new ForbiddenException('User context not found');
    return { tenantId: req.user.tenantId, userId: req.user.userId };
  }

  @Get()
  @RequirePermissions(['staff.view'])
  @ApiOperation({ summary: "A person's employment record(s)" })
  async list(
    @Param('personId') personId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId } = this.ctx(req);
    return this.employment.listForPerson(tenantId, personId);
  }

  @Get('managers')
  @RequirePermissions(['staff.view'])
  @ApiOperation({ summary: 'Active staff to pick a reporting line from' })
  async managers(
    @Request() req: AuthenticatedRequest,
    @Query('exclude') exclude?: string,
  ) {
    const { tenantId } = this.ctx(req);
    return this.employment.managers(tenantId, exclude);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(['staff.create'])
  @ApiOperation({
    summary: 'Open an employment (independent of any payroll run)',
  })
  async create(
    @Param('personId') personId: string,
    @Body() dto: CreateEmploymentDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, userId } = this.ctx(req);
    return this.employment.create(tenantId, userId, personId, dto);
  }

  @Patch(':employmentId')
  @RequirePermissions(['staff.edit'])
  @ApiOperation({ summary: 'Update an employment' })
  async update(
    @Param('employmentId') employmentId: string,
    @Body() dto: UpdateEmploymentDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, userId } = this.ctx(req);
    return this.employment.update(tenantId, userId, employmentId, dto);
  }

  @Post(':employmentId/disable')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(['staff.edit'])
  @ApiOperation({ summary: 'Disable (end) an employment' })
  async disable(
    @Param('employmentId') employmentId: string,
    @Body() dto: DisableEmploymentDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, userId } = this.ctx(req);
    return this.employment.disable(tenantId, userId, employmentId, dto);
  }

  @Post(':employmentId/qualifications')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(['staff.edit'])
  @ApiOperation({ summary: 'Add a qualification to an employment' })
  async addQualification(
    @Param('employmentId') employmentId: string,
    @Body() dto: AddQualificationDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, userId } = this.ctx(req);
    return this.employment.addQualification(
      tenantId,
      userId,
      employmentId,
      dto,
    );
  }

  @Delete(':employmentId/qualifications/:qualificationId')
  @RequirePermissions(['staff.delete'])
  @ApiOperation({ summary: 'Remove a qualification' })
  async removeQualification(
    @Param('qualificationId') qualificationId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, userId } = this.ctx(req);
    return this.employment.removeQualification(
      tenantId,
      userId,
      qualificationId,
    );
  }
}
