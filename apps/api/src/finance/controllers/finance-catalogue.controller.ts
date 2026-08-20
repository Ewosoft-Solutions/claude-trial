import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
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
import { TenantScoped } from '../../common/database/rls-tenant.interceptor';
import type { AuthenticatedRequest } from 'src/auth';
import { FinanceCatalogueService } from '../services/finance-catalogue.service';
import {
  CreateFeeItemDto,
  CreateInvoiceLineDto,
  UpdateFeeItemDto,
  UpdateInvoiceLineDto,
} from '../dto/catalogue.dto';

/** Fee-item catalogue management + invoice line items. */
@ApiTags(SwaggerTags.finance.name)
@Controller('finance')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
@TenantScoped()
@ApiBearerAuth('JWT-auth')
export class FinanceCatalogueController {
  constructor(private readonly catalogue: FinanceCatalogueService) {}

  // ---- Fee items ------------------------------------------------------

  @Get('fee-items')
  @RequirePermissions(['finance.view'])
  @ApiOperation({ summary: 'List the tenant fee-item catalogue' })
  listFeeItems(@Request() req: AuthenticatedRequest) {
    return this.catalogue.listFeeItems(req.user!.tenantId);
  }

  @Post('fee-items')
  @RequirePermissions(['finance.manage'])
  @ApiOperation({ summary: 'Add a fee item to the catalogue' })
  createFeeItem(
    @Body() dto: CreateFeeItemDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.catalogue.createFeeItem(req.user!.tenantId, dto);
  }

  @Patch('fee-items/:id')
  @RequirePermissions(['finance.manage'])
  @ApiOperation({ summary: 'Edit a fee item (name / amount / active)' })
  updateFeeItem(
    @Param('id') id: string,
    @Body() dto: UpdateFeeItemDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.catalogue.updateFeeItem(req.user!.tenantId, id, dto);
  }

  // ---- Invoice lines --------------------------------------------------

  @Get('invoices/:id/lines')
  @RequirePermissions(['finance.view'])
  @ApiOperation({ summary: "List an invoice's line items" })
  listLines(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.catalogue.listLines(req.user!.tenantId, id);
  }

  @Post('invoices/:id/lines')
  @RequirePermissions(['finance.manage'])
  @ApiOperation({ summary: 'Add a line to an invoice' })
  addLine(
    @Param('id') id: string,
    @Body() dto: CreateInvoiceLineDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.catalogue.addLine(req.user!.tenantId, id, dto);
  }

  @Patch('lines/:lineId')
  @RequirePermissions(['finance.manage'])
  @ApiOperation({ summary: 'Edit an invoice line' })
  updateLine(
    @Param('lineId') lineId: string,
    @Body() dto: UpdateInvoiceLineDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.catalogue.updateLine(
      req.user!.tenantId,
      lineId,
      dto,
      req.user!.profileId,
    );
  }

  @Delete('lines/:lineId')
  @RequirePermissions(['finance.manage'])
  @ApiOperation({ summary: 'Remove an invoice line' })
  removeLine(
    @Param('lineId') lineId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.catalogue.removeLine(req.user!.tenantId, lineId);
  }
}
