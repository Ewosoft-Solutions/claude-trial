import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../auth/guards/tenant-context.guard';
import {
  PermissionGuard,
  RequirePermissions,
} from '../../auth/guards/permission.guard';
import { AssessmentGradingService } from '../services/assessment-grading.service';
import { CreateGradeDto, UpdateGradeDto } from '../dto';
import { RequestUser } from '../../auth/types/request-user';

@ApiTags('grades')
@Controller('grades')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
@ApiBearerAuth('JWT-auth')
export class GradeController {
  constructor(private readonly gradingService: AssessmentGradingService) {}

  @Post()
  @RequirePermissions(['grades.create'])
  @ApiOperation({ summary: 'Create grade for a student assessment' })
  async create(
    @Body() dto: CreateGradeDto,
    @Request() req: { user?: RequestUser },
  ) {
    const user = req.user!;
    return this.gradingService.createGrade(user.tenantId, user.userId, dto);
  }

  @Put(':id')
  @RequirePermissions(['grades.edit'])
  @ApiOperation({ summary: 'Update grade' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateGradeDto,
    @Request() req: { user?: RequestUser },
  ) {
    const user = req.user!;
    return this.gradingService.updateGrade(user.tenantId, user.userId, id, dto);
  }

  @Get('assessment/:assessmentId')
  @RequirePermissions(['grades.view'])
  @ApiOperation({ summary: 'List grades for an assessment' })
  async listByAssessment(
    @Param('assessmentId') assessmentId: string,
    @Request() req: { user?: RequestUser },
  ) {
    const user = req.user!;
    return this.gradingService.listGradesForAssessment(user.tenantId, assessmentId);
  }

  @Get('assessment/:assessmentId/stats')
  @RequirePermissions(['grades.view'])
  @ApiOperation({ summary: 'Get assessment grade statistics' })
  async stats(
    @Param('assessmentId') assessmentId: string,
    @Request() req: { user?: RequestUser },
  ) {
    const user = req.user!;
    return this.gradingService.getAssessmentStats(user.tenantId, assessmentId);
  }

  @Get('student/:studentId')
  @RequirePermissions(['grades.view'])
  @ApiOperation({ summary: 'List grades for a student (report card)' })
  async listByStudent(
    @Param('studentId') studentId: string,
    @Request() req: { user?: RequestUser },
  ) {
    const user = req.user!;
    return this.gradingService.listGradesForStudent(user.tenantId, studentId);
  }

  @Post('student/:studentId/report-card')
  @RequirePermissions(['grades.view'])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate report card (simplified)' })
  async reportCard(
    @Param('studentId') studentId: string,
    @Body() body: { academicYearId?: string },
    @Request() req: { user?: RequestUser },
  ) {
    const user = req.user!;
    return this.gradingService.getStudentReportCard(
      user.tenantId,
      studentId,
      body.academicYearId,
    );
  }
}

