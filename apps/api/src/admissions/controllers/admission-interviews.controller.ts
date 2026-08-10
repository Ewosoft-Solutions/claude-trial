import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
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
import { AdmissionInterviewsService } from '../services/admission-interviews.service';
import {
  CancelInterviewDto,
  RecordOutcomeDto,
  ScheduleInterviewDto,
  SubmitQuizDto,
  UpdateInterviewDto,
} from '../dto/admission-interviews.dto';
import type { AuthenticatedRequest } from 'src/auth';

/**
 * WB3-4 · interview / exam / screening scheduling, structured outcomes, and the
 * inline admission quiz. Scheduling + outcomes + quiz are gated
 * `admissions.interviews` (clearance 7, existing); reads are `admissions.view`.
 * RLS-scoped, tenant-only client.
 */
@ApiTags(SwaggerTags.admissions.name)
@Controller('admissions')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
@TenantScoped()
@ApiBearerAuth('JWT-auth')
export class AdmissionInterviewsController {
  constructor(private readonly interviews: AdmissionInterviewsService) {}

  private tenantId(req: AuthenticatedRequest): string {
    if (!req.user) throw new ForbiddenException('User context not found');
    return req.user.tenantId;
  }

  private actorId(req: AuthenticatedRequest): string {
    if (!req.user) throw new ForbiddenException('User context not found');
    return req.user.userId;
  }

  @Get('applications/:id/interviews')
  @RequirePermissions(['admissions.view'])
  @ApiOperation({ summary: "An application's interviews / exams / screenings" })
  list(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.interviews.listForApplication(this.tenantId(req), id);
  }

  @Post('applications/:id/interviews')
  @RequirePermissions(['admissions.interviews'])
  @ApiOperation({ summary: 'Schedule an interview / exam / screening' })
  schedule(
    @Param('id') id: string,
    @Body() dto: ScheduleInterviewDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.interviews.schedule(
      this.tenantId(req),
      id,
      this.actorId(req),
      dto,
    );
  }

  @Patch('interviews/:interviewId')
  @RequirePermissions(['admissions.interviews'])
  @ApiOperation({ summary: 'Reschedule / edit a scheduled interview' })
  update(
    @Param('interviewId') interviewId: string,
    @Body() dto: UpdateInterviewDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.interviews.update(
      this.tenantId(req),
      interviewId,
      this.actorId(req),
      dto,
    );
  }

  @Post('interviews/:interviewId/cancel')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(['admissions.interviews'])
  @ApiOperation({ summary: 'Cancel / mark no-show' })
  cancel(
    @Param('interviewId') interviewId: string,
    @Body() dto: CancelInterviewDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.interviews.cancel(
      this.tenantId(req),
      interviewId,
      this.actorId(req),
      dto,
    );
  }

  @Post('interviews/:interviewId/outcome')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(['admissions.interviews'])
  @ApiOperation({ summary: 'Record a structured outcome (marks completed)' })
  outcome(
    @Param('interviewId') interviewId: string,
    @Body() dto: RecordOutcomeDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.interviews.recordOutcome(
      this.tenantId(req),
      interviewId,
      this.actorId(req),
      dto,
    );
  }

  @Post('interviews/:interviewId/quiz')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(['admissions.interviews'])
  @ApiOperation({ summary: "Submit an applicant's quiz answers (auto-marked)" })
  submitQuiz(
    @Param('interviewId') interviewId: string,
    @Body() dto: SubmitQuizDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.interviews.submitQuiz(
      this.tenantId(req),
      interviewId,
      this.actorId(req),
      dto,
    );
  }
}
