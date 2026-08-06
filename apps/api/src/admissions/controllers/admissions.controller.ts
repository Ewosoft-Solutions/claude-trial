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
  Query,
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
import { AdmissionsService } from '../services/admissions.service';
import type { StructureActor } from '../../academic-structure/services/academic-structure-model.service';
import {
  AddReviewDto,
  AdvanceStageDto,
  ConvertToStudentDto,
  CreateApplicationDto,
  DecisionNoteDto,
  ListApplicationsDto,
  MakeOfferDto,
  UpdateApplicationDto,
} from '../dto/admissions.dto';
import type { AuthenticatedRequest } from 'src/auth';

/**
 * WB3 · Admissions pipeline. Reads gated `admissions.view`; submission
 * `admissions.create`; pipeline advance + scored reviews `admissions.review`;
 * offer/accept `admissions.approve`, reject `admissions.reject` (existing); the
 * one-command conversion to a registered student `admissions.convert` (new;
 * campus-scoped in the service). All routes authenticated + RLS-scoped; runs on
 * the tenant-scoped client only.
 */
@ApiTags(SwaggerTags.admissions.name)
@Controller('admissions')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
@TenantScoped()
@ApiBearerAuth('JWT-auth')
export class AdmissionsController {
  constructor(private readonly admissions: AdmissionsService) {}

  private tenantId(req: AuthenticatedRequest): string {
    if (!req.user) throw new ForbiddenException('User context not found');
    return req.user.tenantId;
  }

  private actorId(req: AuthenticatedRequest): string {
    if (!req.user) throw new ForbiddenException('User context not found');
    return req.user.userId;
  }

  private actor(req: AuthenticatedRequest): StructureActor {
    if (!req.user) throw new ForbiddenException('User context not found');
    return {
      userId: req.user.userId,
      grantScope: req.userContext?.grantScope ?? null,
    };
  }

  // ---- reads ----
  @Get('applications')
  @RequirePermissions(['admissions.view'])
  @ApiOperation({ summary: 'List admission applications' })
  list(
    @Query() query: ListApplicationsDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.admissions.listApplications(this.tenantId(req), query);
  }

  @Get('applications/summary')
  @RequirePermissions(['admissions.view'])
  @ApiOperation({ summary: 'Pipeline summary (stage + decision counts)' })
  summary(@Request() req: AuthenticatedRequest) {
    return this.admissions.pipelineSummary(this.tenantId(req));
  }

  @Get('applications/:id')
  @RequirePermissions(['admissions.view'])
  @ApiOperation({ summary: 'An application + its stage + review history' })
  get(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.admissions.getApplication(this.tenantId(req), id);
  }

  // ---- create / update ----
  @Post('applications')
  @RequirePermissions(['admissions.create'])
  @ApiOperation({ summary: 'Submit a new admission application' })
  create(
    @Body() dto: CreateApplicationDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.admissions.createApplication(
      this.tenantId(req),
      dto,
      this.actorId(req),
    );
  }

  @Patch('applications/:id')
  @RequirePermissions(['admissions.review'])
  @ApiOperation({ summary: 'Update an application note' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateApplicationDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.admissions.updateApplication(
      this.tenantId(req),
      id,
      dto,
      this.actorId(req),
    );
  }

  // ---- pipeline + reviews ----
  @Post('applications/:id/advance')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(['admissions.review'])
  @ApiOperation({ summary: 'Advance the application to the next stage' })
  advance(
    @Param('id') id: string,
    @Body() dto: AdvanceStageDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.admissions.advanceStage(
      this.tenantId(req),
      id,
      dto,
      this.actorId(req),
    );
  }

  @Post('applications/:id/reviews')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(['admissions.review'])
  @ApiOperation({ summary: 'Add a scored review (kept as decision history)' })
  review(
    @Param('id') id: string,
    @Body() dto: AddReviewDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.admissions.addReview(
      this.tenantId(req),
      id,
      dto,
      this.actorId(req),
    );
  }

  // ---- offer / accept / reject ----
  @Post('applications/:id/offer')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(['admissions.approve'])
  @ApiOperation({ summary: 'Offer a place' })
  offer(
    @Param('id') id: string,
    @Body() dto: MakeOfferDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.admissions.makeOffer(
      this.tenantId(req),
      id,
      dto,
      this.actorId(req),
    );
  }

  @Post('applications/:id/accept')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(['admissions.approve'])
  @ApiOperation({ summary: 'Record acceptance of an offer' })
  accept(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.admissions.recordAcceptance(
      this.tenantId(req),
      id,
      this.actorId(req),
    );
  }

  @Post('applications/:id/reject')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(['admissions.reject'])
  @ApiOperation({ summary: 'Reject an application' })
  reject(
    @Param('id') id: string,
    @Body() dto: DecisionNoteDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.admissions.reject(
      this.tenantId(req),
      id,
      dto,
      this.actorId(req),
    );
  }

  // ---- one-command conversion → student ----
  @Post('applications/:id/convert')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(['admissions.convert'])
  @ApiOperation({
    summary: 'Convert an accepted application into a registered student',
  })
  convert(
    @Param('id') id: string,
    @Body() dto: ConvertToStudentDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.admissions.convertToStudent(
      this.tenantId(req),
      this.actor(req),
      id,
      dto,
    );
  }
}
