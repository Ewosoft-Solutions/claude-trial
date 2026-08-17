import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Put,
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
import { AssessmentGradingService } from '../services/assessment-grading.service';
import {
  CreateAssessmentDto,
  UpdateAssessmentDto,
  ListAssessmentsDto,
} from '../dto';
import type { AuthenticatedRequest } from 'src/auth';

@ApiTags(SwaggerTags.assessments.name)
@Controller('assessments')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
@TenantScoped()
@ApiBearerAuth('JWT-auth')
export class AssessmentController {
  constructor(private readonly gradingService: AssessmentGradingService) {}

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
  @RequirePermissions(['assessments.create'])
  @ApiOperation({ summary: 'Create assessment' })
  async create(
    @Body() dto: CreateAssessmentDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.gradingService.createAssessment(
      req.user.tenantId,
      this.actorFrom(req),
      dto,
    );
  }

  @Get()
  @RequirePermissions(['assessments.view'])
  @ApiOperation({ summary: 'List assessments' })
  async list(
    @Query() query: ListAssessmentsDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.gradingService.listAssessments(
      req.user.tenantId,
      this.actorFrom(req),
      query,
    );
  }

  // Declared before ':id' so the literal path is not captured as an id.
  @Get('offerings')
  @RequirePermissions(['assessments.view'])
  @ApiOperation({
    summary: 'Subject offerings the caller may author assessments for',
    description:
      'The workbench picker. Narrowed to the actor’s active teaching ' +
      'assignments unless they hold the manage-all override.',
  })
  async offerings(@Request() req: AuthenticatedRequest) {
    return this.gradingService.listTeachableOfferings(
      req.user.tenantId,
      this.actorFrom(req),
    );
  }

  @Get(':id')
  @RequirePermissions(['assessments.view'])
  @ApiOperation({ summary: 'Get assessment by ID' })
  async get(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.gradingService.getAssessment(
      req.user.tenantId,
      this.actorFrom(req),
      id,
    );
  }

  @Put(':id')
  @RequirePermissions(['assessments.edit'])
  @ApiOperation({ summary: 'Update assessment' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateAssessmentDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.gradingService.updateAssessment(
      req.user.tenantId,
      this.actorFrom(req),
      id,
      dto,
    );
  }

  @Delete(':id')
  @RequirePermissions(['assessments.delete'])
  @ApiOperation({ summary: 'Delete assessment' })
  async delete(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.gradingService.deleteAssessment(
      req.user.tenantId,
      this.actorFrom(req),
      id,
    );
  }
}
