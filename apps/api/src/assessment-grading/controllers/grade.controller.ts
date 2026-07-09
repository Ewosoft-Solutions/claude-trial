import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
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
import { CreateGradeDto, UpdateGradeDto } from '../dto';
import type { AuthenticatedRequest } from 'src/auth';

@ApiTags(SwaggerTags.grades.name)
@Controller('grades')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
@TenantScoped()
@ApiBearerAuth('JWT-auth')
export class GradeController {
  constructor(private readonly gradingService: AssessmentGradingService) {}

  private actorFrom(req: AuthenticatedRequest): AcademicsActor {
    if (!req.userContext) {
      throw new ForbiddenException('User context not found');
    }
    return buildAcademicsActor(
      req.userContext,
      'grades.view',
      'assessments.manage.all',
    );
  }

  @Post()
  @RequirePermissions(['grades.create'])
  @ApiOperation({ summary: 'Create grade for a student assessment' })
  async create(
    @Body() dto: CreateGradeDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.gradingService.createGrade(
      req.user.tenantId,
      this.actorFrom(req),
      dto,
    );
  }

  @Put(':id')
  @RequirePermissions(['grades.edit'])
  @ApiOperation({ summary: 'Update grade' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateGradeDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.gradingService.updateGrade(
      req.user.tenantId,
      this.actorFrom(req),
      id,
      dto,
    );
  }

  @Get('assessment/:assessmentId')
  @RequirePermissions(['grades.view'])
  @ApiOperation({ summary: 'List grades for an assessment' })
  async listByAssessment(
    @Param('assessmentId') assessmentId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.gradingService.listGradesForAssessment(
      req.user.tenantId,
      this.actorFrom(req),
      assessmentId,
    );
  }

  @Get('assessment/:assessmentId/stats')
  @RequirePermissions(['grades.view'])
  @ApiOperation({
    summary: 'Get assessment grade analytics (stats + histogram + top/bottom)',
  })
  async stats(
    @Param('assessmentId') assessmentId: string,
    @Query('bucketSize') bucketSize: string | undefined,
    @Request() req: AuthenticatedRequest,
  ) {
    const bucket = bucketSize ? Number(bucketSize) : undefined;
    return this.gradingService.getAssessmentAnalytics(
      req.user.tenantId,
      this.actorFrom(req),
      assessmentId,
      bucket ?? 10,
    );
  }

  @Get('student/:studentId')
  @RequirePermissions(['grades.view'])
  @ApiOperation({ summary: 'List grades for a student (report card)' })
  async listByStudent(
    @Param('studentId') studentId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.gradingService.listGradesForStudent(
      req.user.tenantId,
      this.actorFrom(req),
      studentId,
    );
  }

  @Post('student/:studentId/report-card')
  @RequirePermissions(['grades.view'])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate report card (simplified)' })
  async reportCard(
    @Param('studentId') studentId: string,
    @Body() body: { academicYearId?: string },
    @Request() req: AuthenticatedRequest,
  ) {
    return this.gradingService.getStudentReportCard(
      req.user.tenantId,
      this.actorFrom(req),
      studentId,
      body.academicYearId,
    );
  }
}
