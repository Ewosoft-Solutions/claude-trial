import {
  Controller,
  ForbiddenException,
  Get,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../../auth/guards/tenant-context.guard';
import {
  PermissionGuard,
  RequirePermissions,
} from '../../../auth/guards/permission.guard';
import { TenantScoped } from '../../../common/database/rls-tenant.interceptor';
import type { AuthenticatedRequest } from '../../../auth/middleware/multi-layer-security.middleware';
import { DeliveryLedgerService } from '../services/delivery-ledger.service';
import { ListDeliveryAttemptsDto } from '../dto';

/**
 * Read surface over the delivery ledger — the delivery log + the SMS-balance /
 * usage view, both reproduced purely from DeliveryAttempt rows (F5 / ADR-07).
 */
@ApiTags('Communication · Delivery')
@Controller('communication/delivery')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
@TenantScoped()
@ApiBearerAuth('JWT-auth')
export class DeliveryController {
  constructor(private readonly ledger: DeliveryLedgerService) {}

  private tenantId(req: AuthenticatedRequest): string {
    if (!req.user?.tenantId) throw new ForbiddenException('No tenant context');
    return req.user.tenantId;
  }

  @Get('attempts')
  @RequirePermissions(['communication.delivery.view'])
  @ApiOperation({ summary: 'List delivery attempts (the delivery log)' })
  list(
    @Query() query: ListDeliveryAttemptsDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.ledger.list(this.tenantId(req), query);
  }

  @Get('usage')
  @RequirePermissions(['communication.delivery.view'])
  @ApiOperation({ summary: 'Per-channel usage + metered cost (SMS balance)' })
  usage(
    @Query('channel') channel: string | undefined,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.ledger.usage(this.tenantId(req), channel);
  }
}
