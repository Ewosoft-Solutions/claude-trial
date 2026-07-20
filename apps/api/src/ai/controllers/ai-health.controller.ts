/**
 * AI Health Controller
 *
 * GET /ai/health — reports AI configuration state and, when a key is
 * configured, proves a live round-trip to the Anthropic API. Gated on
 * ai.configure (the round-trip is a paid API call, so it is not public).
 */
import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SwaggerTags } from '../../common/swagger-tags';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../auth/guards/tenant-context.guard';
import {
  PermissionGuard,
  RequirePermissions,
} from '../../auth/guards/permission.guard';
import { AnthropicService } from '../services/anthropic.service';

@ApiTags(SwaggerTags.ai.name)
@Controller('ai')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
@ApiBearerAuth('JWT-auth')
export class AiHealthController {
  constructor(private readonly anthropicService: AnthropicService) {}

  @Get('health')
  @RequirePermissions(['ai.configure'])
  @ApiOperation({
    summary:
      'AI health: config state + live Anthropic round-trip (when configured)',
  })
  async health() {
    const base = {
      enabled: this.anthropicService.isEnabled,
      available: this.anthropicService.isAvailable,
      model: this.anthropicService.model,
    };

    if (!this.anthropicService.isAvailable) {
      return { ...base, roundTrip: null };
    }

    try {
      const roundTrip = await this.anthropicService.ping();
      return { ...base, roundTrip };
    } catch (error) {
      const typed = this.anthropicService.toTypedError(error);
      return {
        ...base,
        roundTrip: { ok: false as const, error: typed.message },
      };
    }
  }
}
