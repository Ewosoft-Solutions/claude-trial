/**
 * AI admin endpoints (Step 6 governance + settings maker-checker follow-up).
 */
import {
  Body,
  Controller,
  Get,
  Param,
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
import type { AuthenticatedRequest } from 'src/auth';
import { AiUsageService } from '../services/ai-usage.service';
import { AiSettingsService } from '../services/ai-settings.service';
import { AiUsageQueryDto } from '../dto/ai-admin.dto';
import {
  AiSettingsChangeRequestDto,
  AiSettingsDecisionDto,
  AiSettingsRejectDto,
} from '../dto/ai-settings.dto';

@ApiTags(SwaggerTags.ai.name)
@Controller('ai/admin')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
@ApiBearerAuth('JWT-auth')
export class AiAdminController {
  constructor(
    private readonly aiUsageService: AiUsageService,
    private readonly aiSettingsService: AiSettingsService,
  ) {}

  @Get('usage')
  @RequirePermissions(['ai.configure'])
  @ApiOperation({
    summary:
      'AI usage governance summary for the current tenant (monthly tokens, quota, concurrency)',
  })
  usage(@Request() req: AuthenticatedRequest, @Query() query: AiUsageQueryDto) {
    const user = req.user!;
    return this.aiUsageService.getTenantUsageSummary(
      user.tenantId,
      user.userId,
      query.month,
    );
  }

  @Get('settings')
  @RequirePermissions(['ai.configure'])
  @ApiOperation({ summary: 'Current AI settings for the tenant (sanitized)' })
  getSettings(@Request() req: AuthenticatedRequest) {
    const user = req.user!;
    return this.aiSettingsService.getSettings(user.tenantId, user.userId);
  }

  @Post('settings/change-request')
  @RequirePermissions(['ai.configure'])
  @ApiOperation({
    summary:
      'Propose an AI-settings change (maker-checker: applies only after a different approver accepts)',
  })
  requestChange(
    @Request() req: AuthenticatedRequest,
    @Body() dto: AiSettingsChangeRequestDto,
  ) {
    const user = req.user!;
    return this.aiSettingsService.createChangeRequest({
      tenantId: user.tenantId,
      userId: user.userId,
      profileId: user.profileId,
      dto,
    });
  }

  @Get('settings/change-requests')
  @RequirePermissions(['ai.configure'])
  @ApiOperation({ summary: 'Pending AI-settings change requests for the tenant' })
  listChanges(@Request() req: AuthenticatedRequest) {
    const user = req.user!;
    return this.aiSettingsService.listPendingChanges(
      user.tenantId,
      user.userId,
    );
  }

  @Post('settings/change-requests/:id/approve')
  @RequirePermissions(['ai.configure'])
  @ApiOperation({ summary: 'Approve + apply a pending AI-settings change' })
  approveChange(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: AiSettingsDecisionDto,
  ) {
    const user = req.user!;
    return this.aiSettingsService.approveChange({
      tenantId: user.tenantId,
      userId: user.userId,
      profileId: user.profileId,
      requestId: id,
      reason: dto.reason,
    });
  }

  @Post('settings/change-requests/:id/reject')
  @RequirePermissions(['ai.configure'])
  @ApiOperation({ summary: 'Reject a pending AI-settings change' })
  rejectChange(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: AiSettingsRejectDto,
  ) {
    const user = req.user!;
    return this.aiSettingsService.rejectChange({
      tenantId: user.tenantId,
      userId: user.userId,
      requestId: id,
      reason: dto.reason,
    });
  }
}
