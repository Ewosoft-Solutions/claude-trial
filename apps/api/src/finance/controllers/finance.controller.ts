import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  Res,
  StreamableFile,
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
import { TenantScoped } from '../../common/database/rls-tenant.interceptor';
import { FinanceService } from '../services/finance.service';
import { FinanceReceiptService } from '../services/finance-receipt.service';
import { FinanceCreditService } from '../services/finance-credit.service';
import {
  ComposeInvoiceDto,
  CreateInvoiceDto,
  ListInvoicesDto,
  UpdateInvoiceDto,
  UpdateInvoiceHeaderDto,
} from '../dto/finance.dto';
import {
  ApplyCreditDto,
  ListCreditsDto,
  ListReceiptsDto,
  RecordReceiptDto,
} from '../dto/receipt.dto';
import { RecordShareDto, UpdateDraftContentsDto } from '../dto/catalogue.dto';
import type { Response } from 'express';
import type { AuthenticatedRequest } from 'src/auth';
import { RequireStepUp, StepUpGuard } from '../../auth/guards/step-up.guard';
import { STEP_UP_OPERATION } from '../../auth/step-up.operations';

@ApiTags(SwaggerTags.finance.name)
@Controller('finance')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
@TenantScoped()
@ApiBearerAuth('JWT-auth')
export class FinanceController {
  constructor(
    private readonly financeService: FinanceService,
    private readonly receipts: FinanceReceiptService,
    private readonly credits: FinanceCreditService,
  ) {}

  // ---- Invoices -------------------------------------------------------

  @Get('invoices')
  @RequirePermissions(['finance.view'])
  @ApiOperation({ summary: 'List fee invoices' })
  async listInvoices(
    @Query() query: ListInvoicesDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.financeService.listInvoices(req.user.tenantId, query);
  }

  @Get('invoices/summary')
  @RequirePermissions(['finance.view'])
  @ApiOperation({ summary: 'Invoice summary (totals + status counts)' })
  async invoiceSummary(
    @Query('termName') termName: string | undefined,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.financeService.invoiceSummary(req.user.tenantId, termName);
  }

  @Get('invoices/:id')
  @RequirePermissions(['finance.view'])
  @ApiOperation({ summary: 'Get a single invoice with its payments' })
  async getInvoice(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.financeService.getInvoice(req.user.tenantId, id);
  }

  @Post('invoices')
  @UseGuards(StepUpGuard)
  @RequireStepUp(STEP_UP_OPERATION.FINANCIAL_FEE_STRUCTURE_UPDATE)
  @RequirePermissions(['finance.manage'])
  @ApiOperation({ summary: 'Create a fee invoice' })
  async createInvoice(
    @Body() dto: CreateInvoiceDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.financeService.createInvoice(
      req.user.tenantId,
      dto,
      req.user.profileId!,
    );
  }

  @Patch('invoices/:id')
  @UseGuards(StepUpGuard)
  @RequireStepUp(STEP_UP_OPERATION.FINANCIAL_FEE_STRUCTURE_UPDATE)
  @RequirePermissions(['finance.manage'])
  @ApiOperation({ summary: 'Update a fee invoice' })
  async updateInvoice(
    @Param('id') id: string,
    @Body() dto: UpdateInvoiceDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.financeService.updateInvoice(
      req.user.tenantId,
      id,
      dto,
      req.user.profileId!,
    );
  }

  /**
   * Write a whole invoice composed in the browser — header, lines, and
   * optionally the issue — in one step-up-gated request.
   *
   * One endpoint rather than create-then-issue because `StepUpGuard` consumes
   * the challenge it verifies: two guarded calls would mean two confirmations
   * for one action.
   */
  @Post('invoices/compose')
  @UseGuards(StepUpGuard)
  @RequireStepUp(STEP_UP_OPERATION.FINANCIAL_FEE_STRUCTURE_UPDATE)
  @RequirePermissions(['finance.manage'])
  @ApiOperation({
    summary: 'Create an invoice with its lines, optionally issued',
  })
  async composeInvoice(
    @Body() dto: ComposeInvoiceDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.financeService.composeInvoice(
      req.user.tenantId,
      dto,
      req.user.profileId!,
    );
  }

  /**
   * Correct a draft's own details. Not step-up gated, unlike `PATCH
   * invoices/:id` above: that route can issue an invoice, which posts a
   * receivable and draws down held credit. This one only edits a draft — the
   * same act, and the same guard, as adding a line to it.
   */
  @Patch('invoices/:id/header')
  @RequirePermissions(['finance.manage'])
  @ApiOperation({
    summary: "Correct a draft invoice's term, due date or notes",
  })
  async updateInvoiceHeader(
    @Param('id') id: string,
    @Body() dto: UpdateInvoiceHeaderDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.financeService.updateInvoiceHeader(
      req.user.tenantId,
      id,
      dto,
      req.user.profileId!,
    );
  }

  /**
   * Save a draft edited in the browser — details and every line — in one call.
   *
   * Same guard as the per-line writes it replaces: composing a draft is not a
   * movement of money, so `finance.manage` without step-up. Note this is a
   * REPLACE (see UpdateDraftContentsDto): last save wins.
   */
  @Patch('invoices/:id/contents')
  @RequirePermissions(['finance.manage'])
  @ApiOperation({ summary: "Save a draft's details and lines in one request" })
  async updateDraftContents(
    @Param('id') id: string,
    @Body() dto: UpdateDraftContentsDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.financeService.updateDraftContents(
      req.user.tenantId,
      id,
      dto,
      req.user.profileId!,
    );
  }

  /**
   * The invoice as a PDF — the document a family receives.
   *
   * `finance.view` reads it, the same authority as seeing the invoice on
   * screen: the PDF shows nothing the route does not. Sending it to someone is
   * a different act, so the web layer records a share separately rather than
   * treating every render as one — a bursar checking a draft before issuing it
   * has not shared anything.
   *
   * `inline` so a preview can render it in place; the browser still offers to
   * save it, and the download button asks for it by name.
   */
  @Get('invoices/:id/pdf')
  @RequirePermissions(['finance.view'])
  @ApiOperation({ summary: 'Render an invoice as a PDF document' })
  async invoicePdf(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { buffer, filename } = await this.financeService.renderInvoicePdf(
      req.user.tenantId,
      id,
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${filename.replace(/[^\w.-]+/g, '_')}"`,
    );
    return new StreamableFile(buffer);
  }

  /**
   * Record that an invoice was sent to someone.
   *
   * Rendering the PDF is not sharing it — a bursar checking a draft before
   * issuing has shown it to nobody — so the two are separate. This is what the
   * school can point at later to answer "who sent this family their bill, and
   * when": the share sheet hands the file to any app on the device, and that
   * is the last moment we can see.
   *
   * Deliberately advisory: it records an intent to share, since the OS never
   * tells us whether the person went through with it.
   */
  @Post('invoices/:id/shared')
  @RequirePermissions(['finance.view'])
  @ApiOperation({ summary: 'Record that an invoice document was shared' })
  async recordInvoiceShared(
    @Param('id') id: string,
    @Body() dto: RecordShareDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.financeService.recordInvoiceShared(
      req.user.tenantId,
      id,
      dto.channel,
      req.user.profileId!,
    );
  }

  // ---- Receipts (money received) --------------------------------------

  @Get('receipts')
  @RequirePermissions(['finance.view'])
  @ApiOperation({ summary: 'List receipts with what each one settled' })
  async listReceipts(
    @Query() query: ListReceiptsDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.receipts.listReceipts(req.user.tenantId, query);
  }

  @Get('receipts/:id')
  @RequirePermissions(['finance.view'])
  @ApiOperation({ summary: 'Get one receipt with its allocations' })
  async getReceipt(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.receipts.getReceipt(req.user.tenantId, id);
  }

  @Post('receipts')
  @UseGuards(StepUpGuard)
  @RequireStepUp(STEP_UP_OPERATION.FINANCIAL_TRANSACTIONS)
  @RequirePermissions(['finance.manage'])
  @ApiOperation({
    summary:
      'Record money received and allocate it across invoices (family checkout)',
  })
  async recordReceipt(
    @Body() dto: RecordReceiptDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.receipts.recordReceipt(
      req.user.tenantId,
      dto,
      req.user.profileId!,
    );
  }

  @Post('receipts/:id/reprint')
  @RequirePermissions(['finance.view'])
  @ApiOperation({ summary: 'Record (and audit) a receipt reprint' })
  async reprintReceipt(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.receipts.recordReprint(
      req.user.tenantId,
      id,
      req.user.profileId!,
    );
  }

  // ---- Credit (overpayment held against future invoices) ---------------

  @Get('credits')
  @RequirePermissions(['finance.view'])
  @ApiOperation({
    summary: 'List account credits and how they were drawn down',
  })
  async listCredits(
    @Query() query: ListCreditsDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.credits.listCredits(req.user.tenantId, query);
  }

  @Post('credits/:id/apply')
  @UseGuards(StepUpGuard)
  @RequireStepUp(STEP_UP_OPERATION.FINANCIAL_TRANSACTIONS)
  @RequirePermissions(['finance.manage'])
  @ApiOperation({ summary: 'Apply held credit to an outstanding invoice' })
  async applyCredit(
    @Param('id') id: string,
    @Body() dto: ApplyCreditDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.credits.applyCredit(
      req.user.tenantId,
      id,
      dto.invoiceId,
      dto.amount,
      req.user.profileId!,
    );
  }
}
