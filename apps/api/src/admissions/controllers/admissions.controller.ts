import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SwaggerTags } from '../../common/swagger-tags';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../auth/guards/tenant-context.guard';
import { PermissionGuard, RequirePermissions } from '../../auth/guards/permission.guard';
import { TenantScoped } from '../../common/database/rls-tenant.interceptor';
import { AdmissionsService } from '../services/admissions.service';
import {
  CreateApplicationDto,
  ListApplicationsDto,
  UpdateApplicationDto,
} from '../dto/admissions.dto';
import type { AuthenticatedRequest } from 'src/auth';

@ApiTags(SwaggerTags.admissions.name)
@Controller('admissions')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
@TenantScoped()
@ApiBearerAuth('JWT-auth')
export class AdmissionsController {
  constructor(private readonly admissionsService: AdmissionsService) {}

  @Get('applications')
  @RequirePermissions(['admissions.view'])
  @ApiOperation({ summary: 'List admission applications' })
  async listApplications(
    @Query() query: ListApplicationsDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.admissionsService.listApplications(req.user.tenantId, query);
  }

  @Get('applications/summary')
  @RequirePermissions(['admissions.view'])
  @ApiOperation({ summary: 'Pipeline summary (stage + decision counts)' })
  async pipelineSummary(@Request() req: AuthenticatedRequest) {
    return this.admissionsService.pipelineSummary(req.user.tenantId);
  }

  @Get('applications/:id')
  @RequirePermissions(['admissions.view'])
  @ApiOperation({ summary: 'Get a single admission application' })
  async getApplication(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.admissionsService.getApplication(req.user.tenantId, id);
  }

  @Post('applications')
  @RequirePermissions(['admissions.create'])
  @ApiOperation({ summary: 'Submit a new admission application' })
  async createApplication(
    @Body() dto: CreateApplicationDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.admissionsService.createApplication(
      req.user.tenantId,
      dto,
      req.user.profileId!,
    );
  }

  @Patch('applications/:id')
  @RequirePermissions(['admissions.review'])
  @ApiOperation({ summary: 'Update an application (stage, decision, notes)' })
  async updateApplication(
    @Param('id') id: string,
    @Body() dto: UpdateApplicationDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.admissionsService.updateApplication(
      req.user.tenantId,
      id,
      dto,
      req.user.profileId!,
    );
  }
}
