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
import { FinanceService } from '../services/finance.service';
import {
  CreateInvoiceDto,
  ListInvoicesDto,
  ListPaymentsDto,
  RecordPaymentDto,
  UpdateInvoiceDto,
} from '../dto/finance.dto';
import type { AuthenticatedRequest } from 'src/auth';

@ApiTags(SwaggerTags.finance.name)
@Controller('finance')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
@TenantScoped()
@ApiBearerAuth('JWT-auth')
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

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
  async getInvoice(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.financeService.getInvoice(req.user.tenantId, id);
  }

  @Post('invoices')
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

  // ---- Payments -------------------------------------------------------

  @Get('payments')
  @RequirePermissions(['finance.view'])
  @ApiOperation({ summary: 'List payment receipts' })
  async listPayments(
    @Query() query: ListPaymentsDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.financeService.listPayments(req.user.tenantId, query);
  }

  @Post('payments')
  @RequirePermissions(['finance.manage'])
  @ApiOperation({ summary: 'Record a payment against an invoice' })
  async recordPayment(
    @Body() dto: RecordPaymentDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.financeService.recordPayment(
      req.user.tenantId,
      dto,
      req.user.profileId!,
    );
  }
}
