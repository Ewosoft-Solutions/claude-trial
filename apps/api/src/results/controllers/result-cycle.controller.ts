import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
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
import { ResultCycleService } from '../services/result-cycle.service';
import { resultContext } from './result-context';
import {
  ConfigureComponentsDto,
  CreateRemarkRuleSetDto,
  CreateResultCycleDto,
  ReviewDto,
  SetCycleSectionsDto,
  UpdateResultCycleDto,
} from '../dto';

/**
 * WB4 · Result-cycle configuration + lifecycle (ADR-04). Reads gated
 * `academics.results.view`; configuration + lifecycle transitions need
 * `academics.results.manage`; campus-scoped via the WB1-6 AccessScopeService.
 */
@ApiTags('Results')
@Controller('academics/results')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
@TenantScoped()
@ApiBearerAuth('JWT-auth')
export class ResultCycleController {
  constructor(private readonly cycles: ResultCycleService) {}

  @Get('cycles')
  @RequirePermissions(['academics.results.view'])
  @ApiOperation({ summary: 'List result cycles' })
  list(@Request() req: AuthenticatedRequest) {
    const { tenantId, actor } = resultContext(req);
    return this.cycles.listCycles(tenantId, actor);
  }

  @Post('cycles')
  @RequirePermissions(['academics.results.manage'])
  @ApiOperation({ summary: 'Create a result cycle' })
  create(
    @Body() dto: CreateResultCycleDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, actor } = resultContext(req);
    return this.cycles.createCycle(tenantId, actor, dto);
  }

  @Get('cycles/:id')
  @RequirePermissions(['academics.results.view'])
  @ApiOperation({ summary: 'A result cycle + its components and sections' })
  get(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    const { tenantId, actor } = resultContext(req);
    return this.cycles.getCycle(tenantId, actor, id);
  }

  @Patch('cycles/:id')
  @RequirePermissions(['academics.results.manage'])
  @ApiOperation({ summary: 'Update cycle config (scale, remark sets, policy)' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateResultCycleDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, actor } = resultContext(req);
    return this.cycles.updateCycle(tenantId, actor, id, dto);
  }

  @Put('cycles/:id/components')
  @RequirePermissions(['academics.results.manage'])
  @ApiOperation({ summary: 'Configure the cycle components (CA/EXAM)' })
  configureComponents(
    @Param('id') id: string,
    @Body() dto: ConfigureComponentsDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, actor } = resultContext(req);
    return this.cycles.configureComponents(tenantId, actor, id, dto);
  }

  @Put('cycles/:id/sections')
  @RequirePermissions(['academics.results.manage'])
  @ApiOperation({ summary: 'Set the class sections in the cycle scope' })
  setSections(
    @Param('id') id: string,
    @Body() dto: SetCycleSectionsDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, actor } = resultContext(req);
    return this.cycles.setSections(tenantId, actor, id, dto);
  }

  @Post('cycles/:id/open-entry')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(['academics.results.manage'])
  @ApiOperation({ summary: 'Open the cycle for score entry' })
  openEntry(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    const { tenantId, actor } = resultContext(req);
    return this.cycles.openEntry(tenantId, actor, id);
  }

  @Post('cycles/:id/close-entry')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(['academics.results.manage'])
  @ApiOperation({ summary: 'Close the cycle for entry' })
  closeEntry(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    const { tenantId, actor } = resultContext(req);
    return this.cycles.closeEntry(tenantId, actor, id);
  }

  @Post('cycles/:id/moderation')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(['academics.results.manage'])
  @ApiOperation({ summary: 'Move an entry-closed cycle to moderation' })
  moderate(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    const { tenantId, actor } = resultContext(req);
    return this.cycles.moveToModeration(tenantId, actor, id);
  }

  @Post('cycles/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(['academics.results.manage'])
  @ApiOperation({ summary: 'Cancel a cycle (not once published)' })
  cancel(
    @Param('id') id: string,
    @Body() dto: ReviewDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, actor } = resultContext(req);
    return this.cycles.cancelCycle(tenantId, actor, id, dto.reason);
  }

  @Get('cycles/:id/validate')
  @RequirePermissions(['academics.results.view'])
  @ApiOperation({ summary: 'Completeness + validation report for a cycle' })
  validate(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    const { tenantId, actor } = resultContext(req);
    return this.cycles.validateCycle(tenantId, actor, id);
  }

  // ---- remark rule sets ----
  @Get('remark-rule-sets')
  @RequirePermissions(['academics.results.view'])
  @ApiOperation({ summary: 'List remark rule sets' })
  listRemarkSets(@Request() req: AuthenticatedRequest) {
    const { tenantId } = resultContext(req);
    return this.cycles.listRemarkRuleSets(tenantId);
  }

  @Post('remark-rule-sets')
  @RequirePermissions(['academics.results.manage'])
  @ApiOperation({ summary: 'Create a structured remark rule set' })
  createRemarkSet(
    @Body() dto: CreateRemarkRuleSetDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, actor } = resultContext(req);
    return this.cycles.createRemarkRuleSet(tenantId, actor, dto);
  }
}
