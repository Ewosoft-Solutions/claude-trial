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
import type { AuthenticatedRequest } from '../../auth/middleware/multi-layer-security.middleware';
import { PeopleDirectoryService } from '../services/people-directory.service';
import {
  BulkExportPeopleDto,
  PeopleDirectoryQueryDto,
  type PeopleType,
} from '../dto';

/**
 * The permission that gates each person-type tab. The workbench itself is gated
 * on `people.view`; opening a tab additionally requires its type permission, so
 * a caller who may see the directory but not (say) staff is refused the Staff
 * tab server-side — not merely hidden in the UI (golden rule 5). Prospects reuse
 * `admissions.view` (a prospect IS an admission application).
 */
const TYPE_PERMISSION: Record<PeopleType, string> = {
  // The unified roster is gated on the workbench permission itself; the
  // type-specific DETAIL still lives behind each dedicated tab's permission.
  all: 'people.view',
  student: 'students.view',
  guardian: 'guardians.view',
  staff: 'staff.view',
  user: 'users.view',
  prospect: 'admissions.view',
};

/** The person-type tabs, in display order (the unified roster first). */
const PEOPLE_TABS: PeopleType[] = [
  'all',
  'student',
  'guardian',
  'staff',
  'user',
  'prospect',
];

/**
 * Governed **People** directory (WB1-1). One server-side surface the People
 * workbench consumes for all five tabs: tenant + permission filtered, contact
 * masked without `people.view_contact`, with a governed per-tab bulk export.
 */
@ApiTags('Directory')
@Controller('directory/people')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
@TenantScoped()
@ApiBearerAuth('JWT-auth')
export class PeopleDirectoryController {
  constructor(
    private readonly directory: PeopleDirectoryService,
    private readonly permissionService: PermissionService,
  ) {}

  private ctx(req: AuthenticatedRequest) {
    if (!req.user || !req.userContext) {
      throw new ForbiddenException('User context not found');
    }
    return { tenantId: req.user.tenantId, userId: req.user.userId };
  }

  /** Enforce the tab's type permission, or refuse the tab. */
  private assertCanViewType(req: AuthenticatedRequest, type: PeopleType) {
    const permission = TYPE_PERMISSION[type];
    const check = this.permissionService.checkPermissions(req.userContext!, [
      permission,
    ]);
    if (!check.granted) {
      throw new ForbiddenException(`missing_permission: ${permission}`);
    }
  }

  /** Whether the caller may see un-masked contact detail. */
  private canViewContact(req: AuthenticatedRequest): boolean {
    return (
      !!req.userContext &&
      this.permissionService.checkPermissions(req.userContext, [
        'people.view_contact',
      ]).granted
    );
  }

  @Get()
  @RequirePermissions(['people.view'])
  @ApiOperation({
    summary:
      'Governed People directory tab (type=all|student|guardian|staff|user|prospect; contact masked without people.view_contact)',
  })
  async list(
    @Query() query: PeopleDirectoryQueryDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId } = this.ctx(req);
    const type = query.type ?? 'all';
    this.assertCanViewType(req, type);
    return this.directory.list(tenantId, type, this.canViewContact(req), query);
  }

  @Get('summary')
  @RequirePermissions(['people.view'])
  @ApiOperation({
    summary:
      'Per-tab record counts for the summary cards (only tabs the caller may view)',
  })
  async summary(@Request() req: AuthenticatedRequest) {
    const { tenantId } = this.ctx(req);
    // Only count tabs the caller is authorized for, so a card is never shown
    // for a tab they can't open.
    const allowed = PEOPLE_TABS.filter(
      (type) =>
        this.permissionService.checkPermissions(req.userContext!, [
          TYPE_PERMISSION[type],
        ]).granted,
    );
    return this.directory.summary(tenantId, allowed);
  }

  @Post('export')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(['people.view'])
  @ApiOperation({
    summary: 'Bulk-export the selected rows of a tab as CSV (audited; masked)',
  })
  async export(
    @Body() dto: BulkExportPeopleDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, userId } = this.ctx(req);
    this.assertCanViewType(req, dto.type);
    return this.directory.export(
      tenantId,
      dto.type,
      userId,
      this.canViewContact(req),
      dto.ids,
    );
  }
}
