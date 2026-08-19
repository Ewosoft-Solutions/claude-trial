import {
  Body,
  Controller,
  Get,
  Header,
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
import {
  PermissionGuard,
  RequirePermissions,
} from '../../auth/guards/permission.guard';
import { RequireStepUp, StepUpGuard } from '../../auth/guards/step-up.guard';
import { STEP_UP_OPERATION } from '../../auth/step-up.operations';
import { TenantScoped } from '../../common/database/rls-tenant.interceptor';
import { LedgerService } from '../services/ledger.service';
import { FinanceReportingService } from '../services/finance-reporting.service';
import {
  CreatePeriodDto,
  ListJournalDto,
  ReverseEntryDto,
  SetPeriodStatusDto,
  TrialBalanceQueryDto,
} from '../dto/ledger.dto';
import type { AuthenticatedRequest } from 'src/auth';

/**
 * The general ledger surface (ADR-10). Reading the books and changing them are
 * separate authorities: `finance.gl.view` to look, `finance.gl.manage` (with
 * step-up) to close a period or reverse an entry — the two operations that
 * decide what history is allowed to say.
 */
@ApiTags(SwaggerTags.finance.name)
@Controller('finance/ledger')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
@TenantScoped()
@ApiBearerAuth('JWT-auth')
export class FinanceLedgerController {
  constructor(
    private readonly ledger: LedgerService,
    private readonly reporting: FinanceReportingService,
  ) {}

  @Get('accounts')
  @RequirePermissions(['finance.gl.view'])
  @ApiOperation({ summary: 'The chart of accounts' })
  async accounts(@Request() req: AuthenticatedRequest) {
    await this.ledger.ensureChart(req.user.tenantId);
    return this.ledger.listAccounts(req.user.tenantId);
  }

  @Get('trial-balance')
  @RequirePermissions(['finance.gl.view'])
  @ApiOperation({ summary: 'Trial balance — debits, credits, and any difference' })
  trialBalance(
    @Query() query: TrialBalanceQueryDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.ledger.trialBalance(req.user.tenantId, query);
  }

  @Get('entries')
  @RequirePermissions(['finance.gl.view'])
  @ApiOperation({ summary: 'Journal entries with their lines' })
  entries(
    @Query() query: ListJournalDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.ledger.listEntries(req.user.tenantId, query);
  }

  @Get('entries/:id')
  @RequirePermissions(['finance.gl.view'])
  @ApiOperation({ summary: 'One journal entry' })
  entry(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.ledger.getEntry(req.user.tenantId, id);
  }

  @Post('entries/:id/reverse')
  @UseGuards(StepUpGuard)
  @RequireStepUp(STEP_UP_OPERATION.FINANCIAL_JOURNAL_REVERSE)
  @RequirePermissions(['finance.gl.manage'])
  @ApiOperation({ summary: 'Reverse a posted entry with a contra entry' })
  reverse(
    @Param('id') id: string,
    @Body() dto: ReverseEntryDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.ledger.reverse(
      req.user.tenantId,
      id,
      req.user.profileId!,
      dto.reason,
    );
  }

  @Get('periods')
  @RequirePermissions(['finance.gl.view'])
  @ApiOperation({ summary: 'Accounting periods' })
  periods(@Request() req: AuthenticatedRequest) {
    return this.ledger.listPeriods(req.user.tenantId);
  }

  @Post('periods')
  @RequirePermissions(['finance.gl.manage'])
  @ApiOperation({ summary: 'Define an accounting period' })
  createPeriod(
    @Body() dto: CreatePeriodDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.ledger.createPeriod(req.user.tenantId, dto);
  }

  @Patch('periods/:id')
  @UseGuards(StepUpGuard)
  @RequireStepUp(STEP_UP_OPERATION.FINANCIAL_PERIOD_CLOSE)
  @RequirePermissions(['finance.gl.manage'])
  @ApiOperation({ summary: 'Close or reopen an accounting period' })
  setPeriodStatus(
    @Param('id') id: string,
    @Body() dto: SetPeriodStatusDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.ledger.setPeriodStatus(
      req.user.tenantId,
      id,
      dto.status,
      req.user.profileId!,
    );
  }

  @Get('export')
  @RequirePermissions(['finance.gl.manage'])
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="journal.csv"')
  @ApiOperation({
    summary:
      'Export the journal as CSV for an external accounting system (ADR-12)',
  })
  export(
    @Query() query: TrialBalanceQueryDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.reporting.exportJournalCsv(req.user.tenantId, query);
  }
}
