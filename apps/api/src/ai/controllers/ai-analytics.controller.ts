/**
 * Analytics AI endpoints (Step 2, docs/ai-integration-plan.md).
 *
 * POST /ai/analytics/chat streams Server-Sent Events (session, delta, tool,
 * complete, error). It is deliberately NOT @TenantScoped: the chat service
 * opens its own short RLS scopes so no DB transaction ever spans an LLM
 * round-trip. The session read endpoints are ordinary scoped requests.
 */
import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Request,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { SwaggerTags } from '../../common/swagger-tags';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../auth/guards/tenant-context.guard';
import {
  PermissionGuard,
  RequirePermissions,
} from '../../auth/guards/permission.guard';
import type { AuthenticatedRequest } from 'src/auth';
import { AnalyticsChatService } from '../services/analytics-chat.service';
import type { AnalyticsChatEvent } from '../services/analytics-chat.service';
import { AnalyticsChatDto } from '../dto/analytics-chat.dto';

@ApiTags(SwaggerTags.ai.name)
@Controller('ai/analytics')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
@ApiBearerAuth('JWT-auth')
export class AiAnalyticsController {
  constructor(private readonly analyticsChatService: AnalyticsChatService) {}

  @Post('chat')
  @RequirePermissions(['ai.analytics.query'])
  @ApiOperation({
    summary:
      'Analytics AI chat (SSE stream: session, delta, tool, complete, error)',
  })
  async chat(
    @Body() dto: AnalyticsChatDto,
    @Request() req: AuthenticatedRequest,
    @Res() res: Response,
  ): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const user = req.user!;
    const events = this.analyticsChatService.chat({
      tenantId: user.tenantId,
      userId: user.userId,
      profileId: user.profileId,
      message: dto.message,
      sessionId: dto.sessionId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    try {
      for await (const event of events) {
        this.writeEvent(res, event);
        if (res.writableEnded || res.destroyed) break;
      }
    } catch (error) {
      this.writeEvent(res, {
        type: 'error',
        message:
          error instanceof Error ? error.message : 'AI request failed',
      });
    } finally {
      if (!res.writableEnded) {
        res.write('event: done\ndata: [DONE]\n\n');
        res.end();
      }
    }
  }

  @Get('sessions')
  @RequirePermissions(['ai.analytics.query'])
  @ApiOperation({ summary: "List the caller's analytics chat sessions" })
  async listSessions(@Request() req: AuthenticatedRequest) {
    const user = req.user!;
    return this.analyticsChatService.listSessions(
      user.tenantId,
      user.profileId,
    );
  }

  @Get('sessions/:id')
  @RequirePermissions(['ai.analytics.query'])
  @ApiParam({ name: 'id', description: 'ChatSession id' })
  @ApiOperation({ summary: 'One owned analytics session with its messages' })
  async getSession(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const user = req.user!;
    const session = await this.analyticsChatService.getSession(
      user.tenantId,
      user.profileId,
      id,
    );
    if (!session) throw new NotFoundException('Chat session not found');
    return session;
  }

  private writeEvent(res: Response, event: AnalyticsChatEvent): void {
    if (res.writableEnded || res.destroyed) return;
    const { type, ...payload } = event;
    res.write(`event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`);
  }
}
