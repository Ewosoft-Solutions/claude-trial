import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
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
import { CurriculumService } from '../services/curriculum.service';
import {
  CreateAuthorityDto,
  CreateFrameworkDto,
  CreateNodeDto,
  CreateOutcomeDto,
  CreateStageDto,
  CreateSubjectDto,
  CreateVersionDto,
} from '../dto/curriculum.dto';

/**
 * Curriculum authoring + lifecycle (F6 / ADR-03). Authoring/activation are
 * privileged; activation additionally requires `curriculum.activate` (the
 * academic-owner gate). Reads return the tenant's own content plus shared
 * national reference versions (RLS).
 */
@ApiTags('Curriculum')
@Controller('curriculum')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
@TenantScoped()
@ApiBearerAuth('JWT-auth')
export class CurriculumController {
  constructor(private readonly curriculum: CurriculumService) {}

  private ctx(req: AuthenticatedRequest) {
    if (!req.user?.tenantId || !req.userContext) {
      throw new ForbiddenException('User context not found');
    }
    return {
      tenantId: req.user.tenantId,
      profileId: req.userContext.profileId,
    };
  }

  // ---- reads ----
  @Get('versions')
  @RequirePermissions(['curriculum.view'])
  @ApiOperation({ summary: 'List curriculum versions (own + national)' })
  listVersions(@Query('frameworkId') frameworkId: string | undefined) {
    // Auth + tenant scope are enforced by the class guards + @TenantScoped; the
    // read itself is RLS-scoped, so no tenantId is threaded through.
    return this.curriculum.listVersions(frameworkId);
  }

  @Get('versions/:id/tree')
  @RequirePermissions(['curriculum.view'])
  @ApiOperation({ summary: 'Full subject/node/outcome tree for a version' })
  tree(@Param('id') id: string) {
    return this.curriculum.getVersionTree(id);
  }

  // ---- authoring ----
  @Post('authorities')
  @RequirePermissions(['curriculum.manage'])
  createAuthority(
    @Body() dto: CreateAuthorityDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, profileId } = this.ctx(req);
    return this.curriculum.createAuthority(tenantId, profileId, dto);
  }

  @Post('frameworks')
  @RequirePermissions(['curriculum.manage'])
  createFramework(
    @Body() dto: CreateFrameworkDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, profileId } = this.ctx(req);
    return this.curriculum.createFramework(tenantId, profileId, dto);
  }

  @Post('versions')
  @RequirePermissions(['curriculum.manage'])
  createVersion(
    @Body() dto: CreateVersionDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, profileId } = this.ctx(req);
    return this.curriculum.createVersion(tenantId, profileId, dto);
  }

  @Post('versions/:id/stages')
  @RequirePermissions(['curriculum.manage'])
  addStage(
    @Param('id') id: string,
    @Body() dto: CreateStageDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, profileId } = this.ctx(req);
    return this.curriculum.addStage(tenantId, profileId, id, dto);
  }

  @Post('versions/:id/subjects')
  @RequirePermissions(['curriculum.manage'])
  addSubject(
    @Param('id') id: string,
    @Body() dto: CreateSubjectDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, profileId } = this.ctx(req);
    return this.curriculum.addSubject(tenantId, profileId, id, dto);
  }

  @Post('subjects/:id/nodes')
  @RequirePermissions(['curriculum.manage'])
  addNode(
    @Param('id') id: string,
    @Body() dto: CreateNodeDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, profileId } = this.ctx(req);
    return this.curriculum.addNode(tenantId, profileId, id, dto);
  }

  @Post('nodes/:id/outcomes')
  @RequirePermissions(['curriculum.manage'])
  addOutcome(
    @Param('id') id: string,
    @Body() dto: CreateOutcomeDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, profileId } = this.ctx(req);
    return this.curriculum.addOutcome(tenantId, profileId, id, dto);
  }

  @Post('nodes/:id/review')
  @RequirePermissions(['curriculum.manage'])
  @ApiOperation({ summary: 'Record a human review of an AI/imported node' })
  reviewNode(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    const { tenantId, profileId } = this.ctx(req);
    return this.curriculum.reviewNode(tenantId, profileId, id);
  }

  // ---- lifecycle (academic-owner gate) ----
  @Post('versions/:id/activate')
  @RequirePermissions(['curriculum.activate'])
  @ApiOperation({
    summary: 'Activate a version (refuses unreviewed AI/imported nodes)',
  })
  activate(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    const { tenantId, profileId } = this.ctx(req);
    return this.curriculum.activateVersion(tenantId, profileId, id);
  }
}
