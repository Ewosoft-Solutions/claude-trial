import {
  Body,
  Controller,
  Param,
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
import {
  FinanceAdjustmentService,
  type AdjustmentActor,
} from '../services/finance-adjustment.service';
import {
  ApprovalDecisionDto,
  CreateAdjustmentDto,
  CreateDiscountPolicyDto,
} from '../dto/adjustment.dto';

/**
 * Fee adjustments + discount policies. Discretionary adjustments and policy
 * activation are maker-checker: the same `finance.manage` permission gates both
 * the request and the approval, but `MakerCheckerService` enforces maker ≠
 * checker + the clearance floor, so a discount can never be self-approved.
 */
@ApiTags(SwaggerTags.finance.name)
@Controller('finance')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
@TenantScoped()
@ApiBearerAuth('JWT-auth')
export class FinanceAdjustmentController {
  constructor(private readonly adjustments: FinanceAdjustmentService) {}

  private actor(req: AuthenticatedRequest): AdjustmentActor {
    return {
      userId: req.user!.userId,
      clearanceLevel: req.userContext?.clearanceLevel ?? 0,
    };
  }

  @Post('adjustments')
  @RequirePermissions(['finance.manage'])
  @ApiOperation({
    summary: 'Request a discretionary adjustment (needs approval)',
  })
  async request(
    @Body() dto: CreateAdjustmentDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.adjustments.requestAdjustment(
      req.user!.tenantId,
      this.actor(req),
      dto,
    );
  }

  @Post('adjustments/:id/approve')
  @RequirePermissions(['finance.manage'])
  @ApiOperation({
    summary: 'Approve a pending adjustment (checker ≠ requester)',
  })
  async approve(
    @Param('id') id: string,
    @Body() dto: ApprovalDecisionDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.adjustments.approveAdjustment(
      req.user!.tenantId,
      this.actor(req),
      id,
      dto.reason,
    );
  }

  @Post('adjustments/:id/reject')
  @RequirePermissions(['finance.manage'])
  @ApiOperation({ summary: 'Reject a pending adjustment' })
  async reject(
    @Param('id') id: string,
    @Body() dto: ApprovalDecisionDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.adjustments.rejectAdjustment(
      req.user!.tenantId,
      this.actor(req),
      id,
      dto.reason ?? 'Rejected',
    );
  }

  @Post('discount-policies')
  @RequirePermissions(['finance.manage'])
  @ApiOperation({
    summary: 'Create a discount policy (activation needs approval)',
  })
  async createPolicy(
    @Body() dto: CreateDiscountPolicyDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.adjustments.createPolicy(
      req.user!.tenantId,
      this.actor(req),
      dto,
    );
  }

  @Post('discount-policies/:id/activate')
  @RequirePermissions(['finance.manage'])
  @ApiOperation({
    summary: 'Activate a pending discount policy (checker ≠ creator)',
  })
  async activatePolicy(
    @Param('id') id: string,
    @Body() dto: ApprovalDecisionDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.adjustments.activatePolicy(
      req.user!.tenantId,
      this.actor(req),
      id,
      dto.reason,
    );
  }
}
