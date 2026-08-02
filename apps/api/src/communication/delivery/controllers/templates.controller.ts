import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../../auth/guards/tenant-context.guard';
import {
  PermissionGuard,
  RequirePermissions,
} from '../../../auth/guards/permission.guard';
import { TenantScoped } from '../../../common/database/rls-tenant.interceptor';
import type { AuthenticatedRequest } from '../../../auth/middleware/multi-layer-security.middleware';
import { TemplateService } from '../services/template.service';
import type { DeliveryChannel } from '../delivery.types';
import { AddTemplateVersionDto, CreateTemplateDto } from '../dto';

/**
 * Message-template authoring. Gated on `communication.templates.manage`.
 */
@ApiTags('Communication · Templates')
@Controller('communication/templates')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
@TenantScoped()
@ApiBearerAuth('JWT-auth')
export class TemplatesController {
  constructor(private readonly templates: TemplateService) {}

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
  @RequirePermissions(['communication.templates.manage'])
  @ApiOperation({ summary: 'List templates (with versions)' })
  list(@Request() req: AuthenticatedRequest) {
    const { tenantId } = this.ctx(req);
    return this.templates.listTemplates(tenantId);
  }

  @Post()
  @RequirePermissions(['communication.templates.manage'])
  @ApiOperation({ summary: 'Create a template' })
  create(@Body() dto: CreateTemplateDto, @Request() req: AuthenticatedRequest) {
    const { tenantId, profileId } = this.ctx(req);
    return this.templates.createTemplate(tenantId, profileId, dto);
  }

  @Post(':id/versions')
  @RequirePermissions(['communication.templates.manage'])
  @ApiOperation({ summary: 'Add (optionally publish) a template version' })
  addVersion(
    @Param('id') id: string,
    @Body() dto: AddTemplateVersionDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, profileId } = this.ctx(req);
    return this.templates.addVersion(tenantId, profileId, id, {
      channel: dto.channel as DeliveryChannel,
      locale: dto.locale,
      subject: dto.subject,
      body: dto.body,
      variables: dto.variables,
      publish: dto.publish,
    });
  }
}
