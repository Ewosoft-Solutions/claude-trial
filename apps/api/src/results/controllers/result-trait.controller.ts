import {
  Body,
  Controller,
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

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../auth/guards/tenant-context.guard';
import {
  PermissionGuard,
  RequirePermissions,
} from '../../auth/guards/permission.guard';
import { TenantScoped } from '../../common/database/rls-tenant.interceptor';
import type { AuthenticatedRequest } from 'src/auth';
import { ResultTraitService } from '../services/result-trait.service';
import { resultContext } from './result-context';
import { ConfigureTraitsDto, RateTraitsDto } from '../dto';

/**
 * WB4-3 · Affective / psychomotor traits. Reading the rubric + grid needs
 * `academics.results.view`; authoring the rubric needs `.manage` (draft only);
 * rating students needs `.enter` and an open cycle — all enforced server-side.
 */
@ApiTags('Results')
@Controller('academics/results')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
@TenantScoped()
@ApiBearerAuth('JWT-auth')
export class ResultTraitController {
  constructor(private readonly traits: ResultTraitService) {}

  @Get('cycles/:id/traits')
  @RequirePermissions(['academics.results.view'])
  @ApiOperation({ summary: "A cycle's behavioural trait rubric" })
  list(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    const { tenantId, actor } = resultContext(req);
    return this.traits.listTraits(tenantId, actor, id);
  }

  @Put('cycles/:id/traits')
  @RequirePermissions(['academics.results.manage'])
  @ApiOperation({ summary: 'Replace the trait rubric (draft cycles only)' })
  configure(
    @Param('id') id: string,
    @Body() dto: ConfigureTraitsDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, actor } = resultContext(req);
    return this.traits.configureTraits(tenantId, actor, id, dto);
  }

  @Get('cycles/:id/trait-grid')
  @RequirePermissions(['academics.results.view'])
  @ApiOperation({ summary: 'Trait rating grid — section list, or one section' })
  grid(
    @Param('id') id: string,
    @Query('sectionId') sectionId: string | undefined,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, actor } = resultContext(req);
    return this.traits.getTraitGrid(tenantId, actor, id, sectionId);
  }

  @Post('cycles/:id/trait-ratings')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(['academics.results.enter'])
  @ApiOperation({ summary: 'Upsert a batch of trait ratings' })
  rate(
    @Param('id') id: string,
    @Body() dto: RateTraitsDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, actor } = resultContext(req);
    return this.traits.rateTraits(tenantId, actor, id, dto);
  }
}
