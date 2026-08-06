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
import { FinanceHouseholdService } from '../services/finance-household.service';
import {
  AddHouseholdMemberDto,
  AddHouseholdPayerDto,
  CreateHouseholdDto,
  MergeHouseholdsDto,
  UpdateHouseholdDto,
} from '../dto/household.dto';

/** Billing households (family accounts) + their temporal members and payers. */
@ApiTags(SwaggerTags.finance.name)
@Controller('finance/households')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
@TenantScoped()
@ApiBearerAuth('JWT-auth')
export class FinanceHouseholdController {
  constructor(private readonly households: FinanceHouseholdService) {}

  @Get()
  @RequirePermissions(['finance.view'])
  @ApiOperation({ summary: 'List billing households' })
  list(@Request() req: AuthenticatedRequest) {
    return this.households.listHouseholds(req.user!.tenantId);
  }

  @Post()
  @RequirePermissions(['finance.manage'])
  @ApiOperation({ summary: 'Create a billing household' })
  create(
    @Body() dto: CreateHouseholdDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.households.createHousehold(
      req.user!.tenantId,
      dto,
      req.user!.userId,
    );
  }

  // Declared before ':id' so "derive" is not captured as a household id.
  @Post('derive')
  @RequirePermissions(['finance.manage'])
  @ApiOperation({
    summary: 'Auto-derive households from guardian clusters (idempotent)',
  })
  derive(@Request() req: AuthenticatedRequest) {
    return this.households.autoDerive(req.user!.tenantId, req.user!.userId);
  }

  @Delete('members/:memberId')
  @RequirePermissions(['finance.manage'])
  @ApiOperation({ summary: 'End a household membership (kept in history)' })
  endMember(
    @Param('memberId') memberId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.households.endMember(req.user!.tenantId, memberId);
  }

  @Delete('payers/:payerId')
  @RequirePermissions(['finance.manage'])
  @ApiOperation({ summary: 'End a household payer (kept in history)' })
  endPayer(
    @Param('payerId') payerId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.households.endPayer(req.user!.tenantId, payerId);
  }

  @Get(':id')
  @RequirePermissions(['finance.view'])
  @ApiOperation({ summary: 'Get a household with its members + payers' })
  get(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.households.getHousehold(req.user!.tenantId, id);
  }

  @Patch(':id')
  @RequirePermissions(['finance.manage'])
  @ApiOperation({ summary: 'Edit a household (name / primary payer name)' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateHouseholdDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.households.updateHousehold(req.user!.tenantId, id, dto);
  }

  @Post(':id/members')
  @RequirePermissions(['finance.manage'])
  @ApiOperation({ summary: 'Add a student to a household' })
  addMember(
    @Param('id') id: string,
    @Body() dto: AddHouseholdMemberDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.households.addMember(req.user!.tenantId, id, dto);
  }

  @Post(':id/payers')
  @RequirePermissions(['finance.manage'])
  @ApiOperation({ summary: 'Add a payer (guardian) to a household' })
  addPayer(
    @Param('id') id: string,
    @Body() dto: AddHouseholdPayerDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.households.addPayer(req.user!.tenantId, id, dto);
  }

  @Post(':id/merge')
  @RequirePermissions(['finance.manage'])
  @ApiOperation({ summary: 'Merge another household into this one' })
  merge(
    @Param('id') id: string,
    @Body() dto: MergeHouseholdsDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.households.merge(req.user!.tenantId, id, dto.sourceHouseholdId);
  }
}
