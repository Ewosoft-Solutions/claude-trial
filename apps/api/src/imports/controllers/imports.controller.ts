import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
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
import { RequireStepUp, StepUpGuard } from '../../auth/guards/step-up.guard';
import { STEP_UP_OPERATION } from '../../auth/step-up.operations';
import { TenantScoped } from '../../common/database/rls-tenant.interceptor';
import type { AuthenticatedRequest } from '../../auth/middleware/multi-layer-security.middleware';
import { ImportService } from '../services/import.service';
import {
  CreateDefinitionDto,
  CreateJobDto,
  AttachSourceFileDto,
  SetMappingDto,
} from '../dto/imports.dto';

/**
 * Import & migration API (F2 / ADR-09). Authenticated, tenant-scoped, and
 * permission-checked server-side. Commit is a high-consequence bulk operation:
 * clearance-gated + step-up (DATA_BULK_IMPORT) + maker-checker approval for
 * financial/grade/history domains.
 */
@ApiTags('Imports')
@Controller('imports')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
@TenantScoped()
@ApiBearerAuth('JWT-auth')
export class ImportsController {
  constructor(private readonly imports: ImportService) {}

  private ctx(req: AuthenticatedRequest) {
    if (!req.user) throw new ForbiddenException('User context not found');
    return { tenantId: req.user.tenantId, userId: req.user.userId };
  }

  @Post('definitions')
  @RequirePermissions(['imports.manage'])
  @ApiOperation({
    summary: 'Create an import definition (+ reconciliation rules)',
  })
  async createDefinition(
    @Body() dto: CreateDefinitionDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, userId } = this.ctx(req);
    return this.imports.createDefinition(tenantId, userId, dto);
  }

  @Post('jobs')
  @RequirePermissions(['imports.manage'])
  @ApiOperation({ summary: 'Start an import job from a definition' })
  async createJob(
    @Body() dto: CreateJobDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, userId } = this.ctx(req);
    return this.imports.createJob(
      tenantId,
      userId,
      dto.definitionKey,
      dto.sourceSystem,
    );
  }

  @Post('jobs/:id/source-file')
  @RequirePermissions(['imports.manage'])
  @ApiOperation({ summary: 'Attach + parse a CSV source file' })
  async attach(
    @Param('id') id: string,
    @Body() dto: AttachSourceFileDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, userId } = this.ctx(req);
    return this.imports.attachSourceFile(tenantId, userId, id, {
      filename: dto.filename,
      mime: dto.mime,
      content: Buffer.from(dto.contentBase64, 'base64'),
    });
  }

  @Post('jobs/:id/mapping')
  @RequirePermissions(['imports.manage'])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set column → target-field mappings' })
  async setMapping(
    @Param('id') id: string,
    @Body() dto: SetMappingDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, userId } = this.ctx(req);
    return this.imports.setMapping(tenantId, userId, id, dto.mappings);
  }

  @Post('jobs/:id/validate')
  @RequirePermissions(['imports.manage'])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validate rows (produces the exception queue)' })
  async validate(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, userId } = this.ctx(req);
    return this.imports.validate(tenantId, userId, id);
  }

  @Post('jobs/:id/dry-run')
  @RequirePermissions(['imports.manage'])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Preview create/update/skip counts without writing',
  })
  async dryRun(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    const { tenantId, userId } = this.ctx(req);
    return this.imports.dryRun(tenantId, userId, id);
  }

  @Post('jobs/:id/approve')
  @RequirePermissions(['imports.approve'], undefined, 7)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Approve a financial/grade/history import (maker-checker)',
  })
  async approve(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    const { tenantId, userId } = this.ctx(req);
    return this.imports.approve(tenantId, userId, id);
  }

  @Post('jobs/:id/commit')
  @RequirePermissions(['imports.commit'], undefined, 7)
  @UseGuards(StepUpGuard)
  @RequireStepUp(STEP_UP_OPERATION.DATA_BULK_IMPORT)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Commit the import idempotently (step-up required)',
  })
  async commit(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    const { tenantId, userId } = this.ctx(req);
    return this.imports.commit(tenantId, userId, id);
  }

  @Post('jobs/:id/reconcile')
  @RequirePermissions(['imports.commit'], undefined, 7)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Run reconciliation gates (money exact)' })
  async reconcile(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, userId } = this.ctx(req);
    return this.imports.reconcile(tenantId, userId, id);
  }

  @Post('jobs/:id/rollback')
  @RequirePermissions(['imports.rollback'], undefined, 8)
  @UseGuards(StepUpGuard)
  @RequireStepUp(STEP_UP_OPERATION.DATA_BULK_IMPORT)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Roll back a committed import (controlled path)' })
  async rollback(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, userId } = this.ctx(req);
    return this.imports.rollback(tenantId, userId, id);
  }

  @Get('jobs/:id')
  @RequirePermissions(['imports.view'])
  @ApiOperation({
    summary: 'Get import job detail (status, counts, reconciliation)',
  })
  async getJob(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    const { tenantId } = this.ctx(req);
    return this.imports.getJobDetail(tenantId, id);
  }

  @Get('jobs/:id/exceptions')
  @RequirePermissions(['imports.view'])
  @ApiOperation({ summary: 'List invalid rows + their validation issues' })
  async exceptions(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId } = this.ctx(req);
    return this.imports.listExceptions(tenantId, id);
  }
}
