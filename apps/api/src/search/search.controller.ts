import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PermissionMode } from '@workspace/api';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../auth/guards/tenant-context.guard';
import {
  PermissionGuard,
  RequirePermissions,
} from '../auth/guards/permission.guard';
import type { AuthenticatedRequest } from '../auth';
import { TenantScoped } from '../common/database/rls-tenant.interceptor';
import { SearchQueryDto } from './dto';
import { SearchService } from './search.service';

@ApiTags('search')
@Controller('search')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
@TenantScoped()
@ApiBearerAuth('JWT-auth')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @RequirePermissions(
    ['students.view', 'schedules.view', 'users.view'],
    PermissionMode.ANY,
  )
  @ApiOperation({
    summary: 'Search records accessible in the active school and profile',
  })
  search(@Query() query: SearchQueryDto, @Request() req: AuthenticatedRequest) {
    return this.searchService.search(
      req.user!.tenantId,
      req.userContext!,
      query,
    );
  }
}
