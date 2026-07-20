import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SwaggerTags } from '../../common/swagger-tags';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../auth/guards/tenant-context.guard';
import { PermissionGuard, RequirePermissions } from '../../auth/guards/permission.guard';
import { TenantScoped } from '../../common/database/rls-tenant.interceptor';
import { ParentPortalService } from '../services/parent-portal.service';
import type { AuthenticatedRequest } from '../../auth';

@ApiTags(SwaggerTags.parentPortal.name)
@Controller('parent-portal')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
@TenantScoped()
@ApiBearerAuth('JWT-auth')
export class ParentPortalController {
  constructor(private readonly parentPortalService: ParentPortalService) {}

  /**
   * Children linked to the caller's own guardian profile (12.x)
   *
   * GET /parent-portal/children
   *
   * Self-scoped: always resolves against `req.user.profileId` (the calling
   * profile from the access token), never an id supplied by the caller —
   * there is no way to ask for another guardian's children through this
   * endpoint.
   */
  @Get('children')
  @RequirePermissions(['parent_portal.view'])
  @ApiOperation({ summary: "List the signed-in guardian's own children with attendance/grade/fee summaries" })
  async getMyChildren(@Request() req: AuthenticatedRequest) {
    return this.parentPortalService.getMyChildren(req.user.tenantId, req.user.profileId!);
  }
}
