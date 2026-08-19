import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { SwaggerTags } from '../../common/swagger-tags';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../auth/guards/tenant-context.guard';
import {
  PermissionGuard,
  RequirePermissions,
} from '../../auth/guards/permission.guard';
import { TenantScoped } from '../../common/database/rls-tenant.interceptor';
import { FinanceReportingService } from '../services/finance-reporting.service';
import { AgingQueryDto, CollectionsQueryDto } from '../dto/report.dto';
import type { AuthenticatedRequest } from 'src/auth';

/** Collections, aging, and whether the books agree with the bills. */
@ApiTags(SwaggerTags.finance.name)
@Controller('finance/reports')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
@TenantScoped()
@ApiBearerAuth('JWT-auth')
export class FinanceReportController {
  constructor(private readonly reporting: FinanceReportingService) {}

  @Get('collections')
  @RequirePermissions(['finance.view'])
  @ApiOperation({ summary: 'What was collected, by day or by method' })
  collections(
    @Query() query: CollectionsQueryDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.reporting.collections(req.user.tenantId, query);
  }

  @Get('aging')
  @RequirePermissions(['finance.view'])
  @ApiOperation({ summary: 'Outstanding debt by how long it has been owed' })
  aging(
    @Query() query: AgingQueryDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.reporting.aging(req.user.tenantId, query);
  }

  @Get('reconciliation')
  @RequirePermissions(['finance.gl.view'])
  @ApiOperation({
    summary: 'Control totals: the receivables subledger against the ledger',
  })
  reconciliation(@Request() req: AuthenticatedRequest) {
    return this.reporting.reconciliation(req.user.tenantId, req.user.profileId);
  }
}
