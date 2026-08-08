import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
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
import type { AuthenticatedRequest } from 'src/auth';
import { ResultEntryService } from '../services/result-entry.service';
import { resultContext } from './result-context';
import { SeedFromGradebookDto, UpsertResultEntriesDto } from '../dto';

/**
 * WB4 · Result score entry (ADR-04). Viewing the grid needs
 * `academics.results.view`; entering/seeding scores needs
 * `academics.results.enter` and is only allowed while the cycle is open.
 */
@ApiTags('Results')
@Controller('academics/results')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
@TenantScoped()
@ApiBearerAuth('JWT-auth')
export class ResultEntryController {
  constructor(private readonly entries: ResultEntryService) {}

  @Get('cycles/:id/grid')
  @RequirePermissions(['academics.results.view'])
  @ApiOperation({ summary: 'Entry grid — section list, or one section detail' })
  grid(
    @Param('id') id: string,
    @Query('sectionId') sectionId: string | undefined,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, actor } = resultContext(req);
    return this.entries.getGrid(tenantId, actor, id, sectionId);
  }

  @Post('cycles/:id/entries')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(['academics.results.enter'])
  @ApiOperation({ summary: 'Upsert a batch of component scores' })
  upsert(
    @Param('id') id: string,
    @Body() dto: UpsertResultEntriesDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, actor } = resultContext(req);
    return this.entries.upsertEntries(tenantId, actor, id, dto);
  }

  @Post('cycles/:id/seed-from-gradebook')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(['academics.results.enter'])
  @ApiOperation({ summary: 'Best-effort seed empty cells from the gradebook' })
  seed(
    @Param('id') id: string,
    @Body() dto: SeedFromGradebookDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, actor } = resultContext(req);
    return this.entries.seedFromGradebook(tenantId, actor, id, dto);
  }
}
