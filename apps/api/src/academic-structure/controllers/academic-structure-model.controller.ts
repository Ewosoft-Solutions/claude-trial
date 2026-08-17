import {
  Body,
  Controller,
  ForbiddenException,
  Get,
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
import type { AuthenticatedRequest } from 'src/auth';
import {
  AcademicStructureModelService,
  type StructureActor,
} from '../services/academic-structure-model.service';
import {
  CreateStageDto,
  UpdateStageDto,
  CreateYearLevelDto,
  UpdateYearLevelDto,
  CreateStreamDto,
  UpdateStreamDto,
  CreateClassSectionDto,
  UpdateClassSectionDto,
  CreateSubjectOfferingDto,
  UpdateSubjectOfferingDto,
  ListYearLevelsDto,
  ListClassSectionsDto,
  ListSubjectOfferingsDto,
} from '../dto';

/**
 * WB2-1 · ADR-02 structured academic model. Reads are gated
 * `academics.structure.view`; mutations `academics.structure.manage` and are
 * campus-scoped through the WB1-6 `AccessScopeService` in the service. All
 * routes are authenticated + RLS-scoped (@TenantScoped).
 */
@ApiTags('Academic Structure')
@Controller('academics/structure')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
@TenantScoped()
@ApiBearerAuth('JWT-auth')
export class AcademicStructureModelController {
  constructor(private readonly structure: AcademicStructureModelService) {}

  private ctx(req: AuthenticatedRequest): {
    tenantId: string;
    actor: StructureActor;
  } {
    if (!req.user) throw new ForbiddenException('User context not found');
    return {
      tenantId: req.user.tenantId,
      actor: {
        userId: req.user.userId,
        grantScope: req.userContext?.grantScope ?? null,
      },
    };
  }

  // ---- stages ----
  @Get('stages')
  @RequirePermissions(['academics.structure.view'])
  @ApiOperation({ summary: 'List stages' })
  listStages(@Request() req: AuthenticatedRequest) {
    return this.structure.listStages(this.ctx(req).tenantId);
  }

  @Post('stages')
  @RequirePermissions(['academics.structure.manage'])
  @ApiOperation({ summary: 'Create a stage' })
  createStage(
    @Body() dto: CreateStageDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, actor } = this.ctx(req);
    return this.structure.createStage(tenantId, actor.userId, dto);
  }

  @Patch('stages/:id')
  @RequirePermissions(['academics.structure.manage'])
  @ApiOperation({ summary: 'Update a stage' })
  updateStage(
    @Param('id') id: string,
    @Body() dto: UpdateStageDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, actor } = this.ctx(req);
    return this.structure.updateStage(tenantId, actor.userId, id, dto);
  }

  // ---- year levels ----
  @Get('year-levels')
  @RequirePermissions(['academics.structure.view'])
  @ApiOperation({ summary: 'List year levels' })
  listYearLevels(
    @Query() query: ListYearLevelsDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.structure.listYearLevels(this.ctx(req).tenantId, query);
  }

  @Post('year-levels')
  @RequirePermissions(['academics.structure.manage'])
  @ApiOperation({ summary: 'Create a year level' })
  createYearLevel(
    @Body() dto: CreateYearLevelDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, actor } = this.ctx(req);
    return this.structure.createYearLevel(tenantId, actor.userId, dto);
  }

  @Patch('year-levels/:id')
  @RequirePermissions(['academics.structure.manage'])
  @ApiOperation({ summary: 'Update a year level' })
  updateYearLevel(
    @Param('id') id: string,
    @Body() dto: UpdateYearLevelDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, actor } = this.ctx(req);
    return this.structure.updateYearLevel(tenantId, actor.userId, id, dto);
  }

  // ---- streams ----
  @Get('streams')
  @RequirePermissions(['academics.structure.view'])
  @ApiOperation({ summary: 'List streams/pathways' })
  listStreams(@Request() req: AuthenticatedRequest) {
    return this.structure.listStreams(this.ctx(req).tenantId);
  }

  @Post('streams')
  @RequirePermissions(['academics.structure.manage'])
  @ApiOperation({ summary: 'Create a stream/pathway' })
  createStream(
    @Body() dto: CreateStreamDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, actor } = this.ctx(req);
    return this.structure.createStream(tenantId, actor.userId, dto);
  }

  @Patch('streams/:id')
  @RequirePermissions(['academics.structure.manage'])
  @ApiOperation({ summary: 'Update a stream/pathway' })
  updateStream(
    @Param('id') id: string,
    @Body() dto: UpdateStreamDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, actor } = this.ctx(req);
    return this.structure.updateStream(tenantId, actor.userId, id, dto);
  }

  // ---- class sections ----
  @Get('sections')
  @RequirePermissions(['academics.structure.view'])
  @ApiOperation({ summary: 'List class sections' })
  listSections(
    @Query() query: ListClassSectionsDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, actor } = this.ctx(req);
    return this.structure.listClassSections(tenantId, actor, query);
  }

  @Post('sections')
  @RequirePermissions(['academics.structure.manage'])
  @ApiOperation({ summary: 'Create a class section (campus-scoped)' })
  createSection(
    @Body() dto: CreateClassSectionDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, actor } = this.ctx(req);
    return this.structure.createClassSection(tenantId, actor, dto);
  }

  @Patch('sections/:id')
  @RequirePermissions(['academics.structure.manage'])
  @ApiOperation({ summary: 'Update a class section (campus-scoped)' })
  updateSection(
    @Param('id') id: string,
    @Body() dto: UpdateClassSectionDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, actor } = this.ctx(req);
    return this.structure.updateClassSection(tenantId, actor, id, dto);
  }

  // ---- subject offerings ----
  @Get('offerings')
  @RequirePermissions(['academics.structure.view'])
  @ApiOperation({ summary: 'List subject offerings' })
  listOfferings(
    @Query() query: ListSubjectOfferingsDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, actor } = this.ctx(req);
    return this.structure.listSubjectOfferings(tenantId, actor, query);
  }

  @Get('offerable-subjects')
  @RequirePermissions(['academics.structure.view'])
  @ApiOperation({
    summary: 'Curriculum subjects that can be offered (for the picker)',
  })
  offerableSubjects() {
    // Auth + tenant scope come from the class guards + @TenantScoped; the read
    // itself is RLS-scoped and spans shared national rows, so it takes no actor.
    return this.structure.listOfferableSubjects();
  }

  @Post('offerings')
  @RequirePermissions(['academics.structure.manage'])
  @ApiOperation({ summary: 'Offer an F6 curriculum subject to a section' })
  createOffering(
    @Body() dto: CreateSubjectOfferingDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, actor } = this.ctx(req);
    return this.structure.createSubjectOffering(tenantId, actor, dto);
  }

  @Patch('offerings/:id')
  @RequirePermissions(['academics.structure.manage'])
  @ApiOperation({ summary: 'Update a subject offering' })
  updateOffering(
    @Param('id') id: string,
    @Body() dto: UpdateSubjectOfferingDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, actor } = this.ctx(req);
    return this.structure.updateSubjectOffering(tenantId, actor, id, dto);
  }

  // ---- explain / class-builder read ----
  @Get('campuses/:campusId')
  @RequirePermissions(['academics.structure.view'])
  @ApiOperation({
    summary: 'The full structure tree for a campus (sections + offerings)',
  })
  getCampusStructure(
    @Param('campusId') campusId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, actor } = this.ctx(req);
    return this.structure.getCampusStructure(tenantId, actor, campusId);
  }
}
