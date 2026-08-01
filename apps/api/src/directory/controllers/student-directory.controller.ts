import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
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
import { PermissionService } from '../../auth/services/permission.service';
import { TenantScoped } from '../../common/database/rls-tenant.interceptor';
import { buildAcademicsActor } from '../../common/academics/academics-access.service';
import type { AuthenticatedRequest } from '../../auth/middleware/multi-layer-security.middleware';
import { StudentDirectoryService } from '../services/student-directory.service';
import { BulkExportStudentsDto, StudentDirectoryQueryDto } from '../dto';

/**
 * Governed students directory (F7). The single server-side surface the Students
 * list consumes: tenant + permission filtered, privacy-aware (contact masked
 * without `students.view.personal_info`), with a governed bulk export.
 */
@ApiTags('Directory')
@Controller('directory/students')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
@TenantScoped()
@ApiBearerAuth('JWT-auth')
export class StudentDirectoryController {
  constructor(
    private readonly directory: StudentDirectoryService,
    private readonly permissionService: PermissionService,
  ) {}

  private ctx(req: AuthenticatedRequest) {
    if (!req.user || !req.userContext) {
      throw new ForbiddenException('User context not found');
    }
    return { tenantId: req.user.tenantId, userId: req.user.userId };
  }

  private actor(req: AuthenticatedRequest) {
    return buildAcademicsActor(
      req.userContext!,
      'students.view',
      'classes.teachers.assign',
    );
  }

  /** Whether the caller may see un-masked student contact detail. */
  private canViewContact(req: AuthenticatedRequest): boolean {
    return (
      !!req.userContext &&
      this.permissionService.checkPermissions(req.userContext, [
        'students.view.personal_info',
      ]).granted
    );
  }

  @Get()
  @RequirePermissions(['students.view'])
  @ApiOperation({
    summary:
      'Governed students directory (page/filter/sort; contact masked without students.view.personal_info)',
  })
  async list(
    @Query() query: StudentDirectoryQueryDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId } = this.ctx(req);
    return this.directory.list(
      tenantId,
      this.actor(req),
      this.canViewContact(req),
      query,
    );
  }

  @Post('export')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(['students.export'])
  @ApiOperation({
    summary: 'Bulk-export the selected rows as CSV (audited; honours masking)',
  })
  async export(
    @Body() dto: BulkExportStudentsDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, userId } = this.ctx(req);
    return this.directory.export(
      tenantId,
      userId,
      this.canViewContact(req),
      dto.ids,
    );
  }
}
