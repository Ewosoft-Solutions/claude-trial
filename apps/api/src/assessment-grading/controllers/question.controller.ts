import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
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
import { TenantScoped } from '../../common/database/rls-tenant.interceptor';
import {
  buildAcademicsActor,
  type AcademicsActor,
} from '../../common/academics/academics-access.service';
import { QuestionBankService } from '../services/question-bank.service';
import {
  CreateQuestionDto,
  ListQuestionsDto,
  UpdateQuestionDto,
} from '../dto/question-bank.dto';
import type { AuthenticatedRequest } from 'src/auth';

@ApiTags(SwaggerTags.assessments.name)
@Controller('questions')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
@TenantScoped()
@ApiBearerAuth('JWT-auth')
export class QuestionController {
  constructor(private readonly questionBank: QuestionBankService) {}

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

  @Post()
  @RequirePermissions(['questions.create'])
  @ApiOperation({ summary: 'Create a question in a course bank (teachers of the course)' })
  async create(
    @Body() dto: CreateQuestionDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.questionBank.createQuestion(
      req.user.tenantId,
      this.actorFrom(req),
      dto,
    );
  }

  @Get()
  @RequirePermissions(['questions.view'])
  @ApiOperation({ summary: 'List question bank entries (filter by course/style/difficulty)' })
  async list(
    @Query() query: ListQuestionsDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.questionBank.listQuestions(
      req.user.tenantId,
      this.actorFrom(req),
      query,
    );
  }

  @Get(':id')
  @RequirePermissions(['questions.view'])
  @ApiOperation({ summary: 'Get a question (with answer/solution — teacher view)' })
  async get(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.questionBank.getQuestion(
      req.user.tenantId,
      this.actorFrom(req),
      id,
    );
  }

  @Patch(':id')
  @RequirePermissions(['questions.edit'])
  @ApiOperation({ summary: 'Update a question' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateQuestionDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.questionBank.updateQuestion(
      req.user.tenantId,
      this.actorFrom(req),
      id,
      dto,
    );
  }

  @Delete(':id')
  @RequirePermissions(['questions.delete'])
  @ApiOperation({ summary: 'Delete a question (retires it if already used on a paper)' })
  async remove(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.questionBank.deleteQuestion(
      req.user.tenantId,
      this.actorFrom(req),
      id,
    );
  }
}
