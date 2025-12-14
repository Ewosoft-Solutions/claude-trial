import {
  Body,
  Controller,
  Delete,
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
@ApiBearerAuth('JWT-auth')
export class AssessmentController {
  constructor(private readonly gradingService: AssessmentGradingService) {}

  @Post()
  @RequirePermissions(['assessments.create'])
  @ApiOperation({ summary: 'Create assessment' })
  async create(
    @Body() dto: CreateAssessmentDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const user = req.user;
    return this.gradingService.createAssessment(
      user.tenantId,
      user.userId,
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
    const user = req.user;
    return this.gradingService.listAssessments(user.tenantId, query);
  }

  @Get(':id')
  @RequirePermissions(['assessments.view'])
  @ApiOperation({ summary: 'Get assessment by ID' })
  async get(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    const user = req.user;
    return this.gradingService.getAssessment(user.tenantId, id);
  }

  @Put(':id')
  @RequirePermissions(['assessments.edit'])
  @ApiOperation({ summary: 'Update assessment' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateAssessmentDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const user = req.user;
    return this.gradingService.updateAssessment(
      user.tenantId,
      user.userId,
      id,
      dto,
    );
  }

  @Delete(':id')
  @RequirePermissions(['assessments.edit'])
  @ApiOperation({ summary: 'Delete assessment' })
  async delete(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    const user = req.user;
    return this.gradingService.deleteAssessment(user.tenantId, id);
  }
}
