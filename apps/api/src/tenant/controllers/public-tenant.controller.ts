/**
 * Public tenant lookup — unauthenticated, for subdomain resolution.
 *
 * The login page on `{slug}.domain` calls this to brand itself with the
 * school's name/type before anyone signs in. Deliberately guard-free (like
 * POST /auth/login) and returns only non-sensitive branding fields.
 */
import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SwaggerTags } from '../../common/swagger-tags';
import { TenantService } from '../services/tenant.service';

@ApiTags(SwaggerTags.tenant.name)
@Controller('public/tenants')
export class PublicTenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Get(':slug')
  @ApiOperation({ summary: 'Resolve a subdomain slug to public school branding' })
  async getBySlug(@Param('slug') slug: string) {
    return this.tenantService.getPublicBySlug(slug);
  }
}
