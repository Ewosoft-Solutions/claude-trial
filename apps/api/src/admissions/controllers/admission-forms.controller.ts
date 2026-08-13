import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
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
import { TenantScoped } from '../../common/database/rls-tenant.interceptor';
import { AdmissionFormsService } from '../services/admission-forms.service';
import {
  SaveFormDefinitionDto,
  SubmitFormResponseDto,
} from '../dto/admission-forms.dto';
import type { FormDefinition } from '@workspace/forms';
import type { AuthenticatedRequest } from 'src/auth';

/**
 * WB3-3 · school-authored, versioned application form + typed responses.
 * Building/publishing the form is gated `admissions.criteria` (the same gate as
 * the requirement template); reading is `admissions.view`; capturing an
 * application's response is `admissions.create`. RLS-scoped, tenant-only client.
 */
@ApiTags(SwaggerTags.admissions.name)
@Controller('admissions')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
@TenantScoped()
@ApiBearerAuth('JWT-auth')
export class AdmissionFormsController {
  constructor(private readonly forms: AdmissionFormsService) {}

  private tenantId(req: AuthenticatedRequest): string {
    if (!req.user) throw new ForbiddenException('User context not found');
    return req.user.tenantId;
  }

  private actorId(req: AuthenticatedRequest): string {
    if (!req.user) throw new ForbiddenException('User context not found');
    return req.user.userId;
  }

  // ---- form versions ----
  @Get('forms')
  @RequirePermissions(['admissions.view'])
  @ApiOperation({ summary: 'List every version of the application form' })
  listVersions(@Request() req: AuthenticatedRequest) {
    return this.forms.listVersions(this.tenantId(req));
  }

  // Declared before `forms/:id` so "current" isn't captured as an id.
  @Get('forms/current')
  @RequirePermissions(['admissions.view'])
  @ApiOperation({ summary: 'The current published application form (or null)' })
  current(@Request() req: AuthenticatedRequest) {
    return this.forms.getCurrentForm(this.tenantId(req));
  }

  @Get('forms/:id')
  @RequirePermissions(['admissions.view'])
  @ApiOperation({ summary: 'A single form version' })
  getVersion(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.forms.getVersion(this.tenantId(req), id);
  }

  @Post('forms')
  @RequirePermissions(['admissions.criteria'])
  @ApiOperation({ summary: 'Create a new draft form version' })
  createDraft(
    @Body() dto: SaveFormDefinitionDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.forms.createDraft(
      this.tenantId(req),
      this.actorId(req),
      dto.definition as unknown as FormDefinition,
    );
  }

  @Patch('forms/:id')
  @RequirePermissions(['admissions.criteria'])
  @ApiOperation({ summary: 'Edit a draft form version' })
  updateDraft(
    @Param('id') id: string,
    @Body() dto: SaveFormDefinitionDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.forms.updateDraft(
      this.tenantId(req),
      this.actorId(req),
      id,
      dto.definition as unknown as FormDefinition,
    );
  }

  @Post('forms/:id/publish')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(['admissions.criteria'])
  @ApiOperation({ summary: 'Publish a draft (supersedes the current form)' })
  publish(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.forms.publishVersion(this.tenantId(req), this.actorId(req), id);
  }

  @Post('forms/:id/archive')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(['admissions.criteria'])
  @ApiOperation({ summary: 'Archive a form version' })
  archive(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.forms.archiveVersion(this.tenantId(req), this.actorId(req), id);
  }

  // ---- application responses ----
  @Get('applications/:id/form-response')
  @RequirePermissions(['admissions.view'])
  @ApiOperation({ summary: "An application's application-form response" })
  getResponse(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.forms.getResponse(this.tenantId(req), id);
  }

  @Put('applications/:id/form-response')
  @RequirePermissions(['admissions.create'])
  @ApiOperation({ summary: 'Capture / update an application-form response' })
  submitResponse(
    @Param('id') id: string,
    @Body() dto: SubmitFormResponseDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.forms.submitResponse(
      this.tenantId(req),
      id,
      this.actorId(req),
      dto.answers,
    );
  }
}
