import {
  Body,
  Controller,
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
import { TenantScoped } from '../../common/database/rls-tenant.interceptor';
import type { AuthenticatedRequest } from 'src/auth';
import { ResultPublicationService } from '../services/result-publication.service';
import { resultContext } from './result-context';
import { CreateAmendmentDto, ReviewDto } from '../dto';

/**
 * WB4 · Publish + amend (ADR-04). Submitting for publish/amend needs
 * `academics.results.manage` (the maker); approving publish/amend needs
 * `academics.results.approve` (the second approver, maker ≠ checker, additionally
 * gated by the WB1-6 maker-checker in the service). Reads need
 * `academics.results.view`.
 */
@ApiTags('Results')
@Controller('academics/results')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
@TenantScoped()
@ApiBearerAuth('JWT-auth')
export class ResultPublicationController {
  constructor(private readonly publications: ResultPublicationService) {}

  @Post('cycles/:id/request-publish')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(['academics.results.manage'])
  @ApiOperation({ summary: 'Submit a complete cycle for publish approval' })
  requestPublish(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, actor } = resultContext(req);
    return this.publications.requestPublish(tenantId, actor, id);
  }

  @Post('cycles/:id/approve-publish')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(['academics.results.approve'])
  @ApiOperation({ summary: 'Approve + publish (must not be the requester)' })
  approvePublish(
    @Param('id') id: string,
    @Body() dto: ReviewDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, actor } = resultContext(req);
    return this.publications.approveAndPublish(tenantId, actor, id, dto.reason);
  }

  @Get('cycles/:id/publications')
  @RequirePermissions(['academics.results.view'])
  @ApiOperation({ summary: 'List a cycle’s publications (versions)' })
  listPublications(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, actor } = resultContext(req);
    return this.publications.listPublications(tenantId, actor, id);
  }

  @Get('publications/:pubId')
  @RequirePermissions(['academics.results.view'])
  @ApiOperation({ summary: 'A publication + its per-student results' })
  getPublication(
    @Param('pubId') pubId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, actor } = resultContext(req);
    return this.publications.getPublication(tenantId, actor, pubId);
  }

  @Get('cycles/:id/amendments')
  @RequirePermissions(['academics.results.view'])
  @ApiOperation({ summary: 'List a cycle’s amendments' })
  listAmendments(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, actor } = resultContext(req);
    return this.publications.listAmendments(tenantId, actor, id);
  }

  @Post('cycles/:id/amendments')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(['academics.results.manage'])
  @ApiOperation({ summary: 'Raise a correction to a published result' })
  requestAmendment(
    @Param('id') id: string,
    @Body() dto: CreateAmendmentDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, actor } = resultContext(req);
    return this.publications.requestAmendment(tenantId, actor, id, dto);
  }

  @Post('amendments/:amendmentId/approve')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(['academics.results.approve'])
  @ApiOperation({ summary: 'Approve + apply an amendment (new version)' })
  approveAmendment(
    @Param('amendmentId') amendmentId: string,
    @Body() dto: ReviewDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, actor } = resultContext(req);
    return this.publications.approveAmendment(
      tenantId,
      actor,
      amendmentId,
      dto.reason,
    );
  }
}
