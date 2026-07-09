/**
 * AI admin endpoints (Step 6 governance).
 */
import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
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
import { AiUsageQueryDto } from '../dto/ai-admin.dto';

@ApiTags(SwaggerTags.ai.name)
@Controller('ai/admin')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
@ApiBearerAuth('JWT-auth')
export class AiAdminController {
  constructor(private readonly aiUsageService: AiUsageService) {}

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
}
