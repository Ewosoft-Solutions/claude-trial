import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Query,
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
import { TenantScoped } from '../../common/database/rls-tenant.interceptor';
import type { AuthenticatedRequest } from '../../auth/middleware/multi-layer-security.middleware';
import { CurriculumAdoptionService } from '../services/curriculum-adoption.service';
import { AdoptDto, ResolveCohortQueryDto } from '../dto/curriculum.dto';

/**
 * Curriculum adoption (F6 / ADR-03): effective-dated cohort adoption + "which
 * version governs cohort C on date D" resolution.
 */
@ApiTags('Curriculum · Adoption')
@Controller('curriculum/adoptions')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
@TenantScoped()
@ApiBearerAuth('JWT-auth')
export class CurriculumAdoptionController {
  constructor(private readonly adoptions: CurriculumAdoptionService) {}

  private ctx(req: AuthenticatedRequest) {
    if (!req.user?.tenantId || !req.userContext) {
      throw new ForbiddenException('User context not found');
    }
    return {
      tenantId: req.user.tenantId,
      profileId: req.userContext.profileId,
    };
  }

  @Get()
  @RequirePermissions(['curriculum.view'])
  @ApiOperation({ summary: 'List curriculum adoptions' })
  list(@Request() req: AuthenticatedRequest) {
    return this.adoptions.listAdoptions(this.ctx(req).tenantId);
  }

  @Get('resolve')
  @RequirePermissions(['curriculum.view'])
  @ApiOperation({ summary: 'Resolve the version governing a cohort on a date' })
  resolve(
    @Query() query: ResolveCohortQueryDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.adoptions.resolveForCohort(
      this.ctx(req).tenantId,
      query.cohort,
      query.campusId,
      query.at,
    );
  }

  @Post()
  @RequirePermissions(['curriculum.adopt'])
  @ApiOperation({
    summary: 'Adopt a version for an entry cohort (effective-dated)',
  })
  adopt(@Body() dto: AdoptDto, @Request() req: AuthenticatedRequest) {
    const { tenantId, profileId } = this.ctx(req);
    return this.adoptions.adopt(tenantId, profileId, dto);
  }
}
