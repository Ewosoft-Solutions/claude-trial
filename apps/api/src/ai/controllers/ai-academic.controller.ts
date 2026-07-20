/**
 * Academic AI tutor endpoints (Step 5, docs/ai-integration-plan.md).
 *
 * POST /ai/academic/chat streams Server-Sent Events (session, sources, delta,
 * complete, error). Before the stream opens it enforces the assessment-window
 * block, returning the requirements' 403 refusal shape as a plain JSON body
 * (not an SSE event) so the client can render the message + alternatives.
 *
 * Deliberately NOT @TenantScoped: the tutor service opens its own short RLS
 * scopes so no DB transaction spans retrieval embeddings or the LLM
 * round-trip. Session read + usage endpoints are ordinary scoped requests.
 */
import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Request,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { SwaggerTags } from '../../common/swagger-tags';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../auth/guards/tenant-context.guard';
import {
  PermissionGuard,
  RequirePermissions,
} from '../../auth/guards/permission.guard';
import type { AuthenticatedRequest } from 'src/auth';
import { AcademicChatService } from '../services/academic-chat.service';
import type { AcademicChatEvent } from '../services/academic-chat.service';
import { AcademicChatDto } from '../dto/academic-chat.dto';

@ApiTags(SwaggerTags.ai.name)
@Controller('ai/academic')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
@ApiBearerAuth('JWT-auth')
export class AiAcademicController {
  constructor(private readonly academicChatService: AcademicChatService) {}

  @Post('chat')
  @RequirePermissions(['ai.chat.use'])
  @ApiOperation({
    summary:
      'Academic AI tutor chat (SSE: session, sources, delta, complete, error). 403 during an active assessment.',
  })
  async chat(
    @Body() dto: AcademicChatDto,
    @Request() req: AuthenticatedRequest,
    @Res() res: Response,
  ): Promise<void> {
    const user = req.user!;

    // Assessment-window block BEFORE the stream opens → real 403 body.
    const block = await this.academicChatService.getAssessmentBlock(
      user.tenantId,
      user.userId,
      user.profileId,
    );
    if (block) {
      res.status(403).json(block);
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const events = this.academicChatService.chat({
      tenantId: user.tenantId,
      userId: user.userId,
      profileId: user.profileId,
      message: dto.message,
      lessonId: dto.lessonId,
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
        message: error instanceof Error ? error.message : 'Tutor request failed',
      });
    } finally {
      if (!res.writableEnded) {
        res.write('event: done\ndata: [DONE]\n\n');
        res.end();
      }
    }
  }

  @Get('sessions')
  @RequirePermissions(['ai.chat.use'])
  @ApiOperation({ summary: "List the caller's tutor chat sessions" })
  async listSessions(@Request() req: AuthenticatedRequest) {
    const user = req.user!;
    return this.academicChatService.listSessions(
      user.tenantId,
      user.userId,
      user.profileId,
    );
  }

  @Get('sessions/:id')
  @RequirePermissions(['ai.chat.use'])
  @ApiParam({ name: 'id', description: 'Academic ChatSession id' })
  @ApiOperation({ summary: 'One owned tutor session with its messages' })
  async getSession(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const user = req.user!;
    const session = await this.academicChatService.getSession(
      user.tenantId,
      user.userId,
      user.profileId,
      id,
    );
    if (!session) throw new NotFoundException('Chat session not found');
    return session;
  }

  @Get('usage')
  @RequirePermissions(['lessons.view'])
  @ApiQuery({
    name: 'classId',
    required: false,
    description: 'Restrict to one class you teach.',
  })
  @ApiOperation({
    summary:
      'Teacher visibility v1: per-class tutor usage (sessions, question counts) for classes you teach',
  })
  async classUsage(
    @Request() req: AuthenticatedRequest,
    @Query('classId') classId?: string,
  ) {
    const user = req.user!;
    if (!req.userContext) {
      throw new ForbiddenException('User context not found');
    }
    const canManageAll =
      req.userContext.permissions.get('lessons.manage.all')?.granted === true;
    return this.academicChatService.listClassUsage(
      user.tenantId,
      user.userId,
      user.profileId,
      canManageAll,
      classId,
    );
  }

  private writeEvent(res: Response, event: AcademicChatEvent): void {
    if (res.writableEnded || res.destroyed) return;
    const { type, ...payload } = event;
    res.write(`event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`);
  }
}
