import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
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
import { FinancialHoldService } from '../services/financial-hold.service';
import { resultContext } from './result-context';
import { CreateFinancialHoldDto, ReleaseFinancialHoldDto } from '../dto';

/**
 * WB4 · FinancialHold (ADR-04) — an explicit, audited hold on a student's result
 * visibility to guardians. Viewing holds needs `academics.results.view`; placing/
 * releasing needs `academics.results.financial_hold` (a finance-level authority).
 */
@ApiTags('Results')
@Controller('academics/results/financial-holds')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
@TenantScoped()
@ApiBearerAuth('JWT-auth')
export class FinancialHoldController {
  constructor(private readonly holds: FinancialHoldService) {}

  @Get()
  @RequirePermissions(['academics.results.view'])
  @ApiOperation({ summary: 'List result financial holds' })
  list(
    @Query('studentId') studentId: string | undefined,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, actor } = resultContext(req);
    return this.holds.list(tenantId, actor, studentId);
  }

  @Post()
  @RequirePermissions(['academics.results.financial_hold'])
  @ApiOperation({ summary: 'Place a result financial hold on a student' })
  place(
    @Body() dto: CreateFinancialHoldDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, actor } = resultContext(req);
    return this.holds.place(tenantId, actor, dto);
  }

  @Post(':id/release')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(['academics.results.financial_hold'])
  @ApiOperation({ summary: 'Release a result financial hold' })
  release(
    @Param('id') id: string,
    @Body() dto: ReleaseFinancialHoldDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, actor } = resultContext(req);
    return this.holds.release(tenantId, actor, id, dto.reason);
  }
}
