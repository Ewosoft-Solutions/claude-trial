import {
  Body,
  Controller,
  Delete,
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
import {
  buildAcademicsActor,
  type AcademicsActor,
} from '../../common/academics/academics-access.service';
import { QuestionBankService } from '../services/question-bank.service';
import { AssessmentTakingService } from '../services/assessment-taking.service';
import {
  AttachQuestionsDto,
  GradeSubmissionDto,
  SubmitAssessmentDto,
} from '../dto/question-bank.dto';
import type { AuthenticatedRequest } from 'src/auth';

/**
 * Question papers + online taking. Lives beside AssessmentController
 * (same /assessments prefix): all routes here are multi-segment so they
 * never collide with its :id routes.
 */
@ApiTags(SwaggerTags.assessments.name)
@Controller('assessments')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
@TenantScoped()
@ApiBearerAuth('JWT-auth')
export class AssessmentTakingController {
  constructor(
    private readonly questionBank: QuestionBankService,
    private readonly taking: AssessmentTakingService,
  ) {}

  private actorFrom(req: AuthenticatedRequest): AcademicsActor {
    if (!req.userContext) {
      throw new ForbiddenException('User context not found');
    }
    return buildAcademicsActor(
      req.userContext,
      'assessments.view',
      'assessments.manage.all',
    );
  }

  // ---- Paper management (teacher) ----

  @Get(':id/questions')
  @RequirePermissions(['assessments.view'])
  @ApiOperation({ summary: 'The paper with answers/solutions (teacher view)' })
  async listPaper(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.questionBank.listPaper(
      req.user.tenantId,
      this.actorFrom(req),
      id,
    );
  }

  @Post(':id/questions')
  @RequirePermissions(['assessments.edit'])
  @ApiOperation({ summary: 'Attach bank questions to the assessment (ordered, weighted)' })
  async attachQuestions(
    @Param('id') id: string,
    @Body() dto: AttachQuestionsDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.questionBank.attachQuestions(
      req.user.tenantId,
      this.actorFrom(req),
      id,
      dto,
    );
  }

  @Delete(':id/questions/:questionId')
  @RequirePermissions(['assessments.edit'])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Detach a question from the assessment' })
  async detachQuestion(
    @Param('id') id: string,
    @Param('questionId') questionId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.questionBank.detachQuestion(
      req.user.tenantId,
      this.actorFrom(req),
      id,
      questionId,
    );
  }

  // ---- Taking (student) ----

  @Get(':id/take')
  @RequirePermissions(['assessments.take'])
  @ApiOperation({ summary: 'The paper without answers (enrolled students, published only)' })
  async take(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.taking.getPaperForStudent(
      req.user.tenantId,
      this.actorFrom(req),
      id,
    );
  }

  @Post(':id/start')
  @RequirePermissions(['assessments.take'])
  @ApiOperation({ summary: 'Start (or resume) a timed attempt' })
  async start(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.taking.startAttempt(
      req.user.tenantId,
      this.actorFrom(req),
      id,
    );
  }

  @Post(':id/submissions')
  @RequirePermissions(['assessments.take'])
  @ApiOperation({
    summary:
      'Submit answers — objective questions auto-mark; fully objective papers grade into the gradebook',
  })
  async submit(
    @Param('id') id: string,
    @Body() dto: SubmitAssessmentDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.taking.submit(
      req.user.tenantId,
      this.actorFrom(req),
      id,
      dto,
    );
  }

  @Get(':id/submissions/mine')
  @RequirePermissions(['assessments.take'])
  @ApiOperation({ summary: "The student's own attempts" })
  async mySubmissions(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.taking.listOwnSubmissions(
      req.user.tenantId,
      this.actorFrom(req),
      id,
    );
  }

  // ---- Submission review (teacher) ----

  @Get(':id/submissions')
  @RequirePermissions(['assessments.view'])
  @ApiOperation({ summary: 'All submissions for an assessment (teachers of the class)' })
  async listSubmissions(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.taking.listSubmissions(
      req.user.tenantId,
      this.actorFrom(req),
      id,
    );
  }

  @Patch('submissions/:id/grade')
  @RequirePermissions(['grades.edit'])
  @ApiOperation({ summary: 'Manually grade a submission (essays) — upserts the gradebook Grade' })
  async gradeSubmission(
    @Param('id') id: string,
    @Body() dto: GradeSubmissionDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.taking.gradeSubmission(
      req.user.tenantId,
      this.actorFrom(req),
      id,
      dto,
    );
  }
}
