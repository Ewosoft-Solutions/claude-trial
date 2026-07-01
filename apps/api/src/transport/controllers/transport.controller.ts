import { Body, Controller, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SwaggerTags } from '../../common/swagger-tags';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../auth/guards/tenant-context.guard';
import { PermissionGuard, RequirePermissions } from '../../auth/guards/permission.guard';
import { TenantScoped } from '../../common/database/rls-tenant.interceptor';
import { TransportService } from '../services/transport.service';
import { CreateAssignmentDto, ListAssignmentsDto, UpdateAssignmentDto } from '../dto/transport.dto';
import type { AuthenticatedRequest } from 'src/auth';

@ApiTags(SwaggerTags.transport.name)
@Controller('transport')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
@TenantScoped()
@ApiBearerAuth('JWT-auth')
export class TransportController {
  constructor(private readonly transportService: TransportService) {}

  @Get('assignments')
  @RequirePermissions(['transportation.view'])
  @ApiOperation({ summary: 'List transport assignments' })
  async listAssignments(@Query() query: ListAssignmentsDto, @Request() req: AuthenticatedRequest) {
    return this.transportService.listAssignments(req.user.tenantId, query);
  }

  @Get('assignments/summary')
  @RequirePermissions(['transportation.view'])
  @ApiOperation({ summary: 'Route summary (per-route + per-status counts)' })
  async routeSummary(@Request() req: AuthenticatedRequest) {
    return this.transportService.routeSummary(req.user.tenantId);
  }

  @Post('assignments')
  @RequirePermissions(['transportation.students'])
  @ApiOperation({ summary: 'Assign a student to a route (creates or replaces their assignment)' })
  async assignStudent(@Body() dto: CreateAssignmentDto, @Request() req: AuthenticatedRequest) {
    return this.transportService.assignStudent(req.user.tenantId, dto, req.user.profileId!);
  }

  @Patch('assignments/:id')
  @RequirePermissions(['transportation.students'])
  @ApiOperation({ summary: 'Update a transport assignment' })
  async updateAssignment(
    @Param('id') id: string,
    @Body() dto: UpdateAssignmentDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.transportService.updateAssignment(req.user.tenantId, id, dto, req.user.profileId!);
  }
}
