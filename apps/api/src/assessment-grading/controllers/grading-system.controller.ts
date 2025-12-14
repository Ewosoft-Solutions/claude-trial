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
import { CreateGradingSystemDto, UpdateGradingSystemDto } from '../dto';
import type { AuthenticatedRequest } from 'src/auth';

@ApiTags(SwaggerTags.gradingSystems.name)
@Controller('grading-systems')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
@ApiBearerAuth('JWT-auth')
export class GradingSystemController {
  constructor(private readonly gradingService: AssessmentGradingService) {}

  @Post()
  @RequirePermissions(['grades.create'])
  @ApiOperation({ summary: 'Create grading system' })
  async create(
    @Body() dto: CreateGradingSystemDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const user = req.user;
    return this.gradingService.createGradingSystem(
      user.tenantId,
      user.userId,
      dto,
    );
  }

  @Get()
  @RequirePermissions(['grades.view'])
  @ApiOperation({ summary: 'List grading systems' })
  async list(
    @Query('active') active: string | undefined,
    @Request() req: AuthenticatedRequest,
  ) {
    const user = req.user;
    const activeBool =
      active === undefined
        ? undefined
        : active === 'true'
          ? true
          : active === 'false'
            ? false
            : undefined;
    return this.gradingService.listGradingSystems(user.tenantId, activeBool);
  }

  @Put(':id')
  @RequirePermissions(['grades.edit'])
  @ApiOperation({ summary: 'Update grading system' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateGradingSystemDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const user = req.user;
    return this.gradingService.updateGradingSystem(
      user.tenantId,
      user.userId,
      id,
      dto,
    );
  }

  @Delete(':id')
  @RequirePermissions(['grades.delete'])
  @ApiOperation({ summary: 'Delete grading system' })
  async delete(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    const user = req.user;
    return this.gradingService.deleteGradingSystem(user.tenantId, id);
  }
}
