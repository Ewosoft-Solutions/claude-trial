import {
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
import { ResultTranscriptService } from '../services/result-transcript.service';
import { resultContext } from './result-context';

/**
 * WB4-4 · Cumulative transcripts. Reading needs `academics.results.view`;
 * ISSUING the immutable transcript artifact needs `.manage` — a transcript is a
 * document that leaves the school, so it is a managed, audited act.
 */
@ApiTags('Results')
@Controller('academics/results')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
@TenantScoped()
@ApiBearerAuth('JWT-auth')
export class ResultTranscriptController {
  constructor(private readonly transcripts: ResultTranscriptService) {}

  @Get('students/:studentId/transcript')
  @RequirePermissions(['academics.results.view'])
  @ApiOperation({
    summary: "A student's cumulative record, from published snapshots only",
  })
  get(
    @Param('studentId') studentId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, actor } = resultContext(req);
    return this.transcripts.getTranscript(tenantId, actor, studentId);
  }

  @Post('students/:studentId/transcript')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(['academics.results.manage'])
  @ApiOperation({ summary: 'Issue the transcript as an immutable artifact' })
  issue(
    @Param('studentId') studentId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, actor } = resultContext(req);
    return this.transcripts.issueTranscript(tenantId, actor, studentId);
  }
}
