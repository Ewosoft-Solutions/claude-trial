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
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../auth/guards/tenant-context.guard';
import {
  PermissionGuard,
  RequirePermissions,
} from '../../auth/guards/permission.guard';
import { PermissionMode } from '@workspace/api';
import { PermissionService } from '../../auth/services/permission.service';
import { TenantScoped } from '../../common/database/rls-tenant.interceptor';
import type { AuthenticatedRequest } from '../../auth/middleware/multi-layer-security.middleware';
import { PersonService } from '../services/person.service';
import { PersonMergeService } from '../services/person-merge.service';
import {
  CreatePersonDto,
  UpdatePersonDto,
  SearchPeopleDto,
  AddContactPointDto,
  ConfirmContactDto,
  AddStaffProfileDto,
  AddGuardianshipDto,
  MergePeopleDto,
} from '../dto/person.dto';

/**
 * People directory + identity API (F1 / ADR-01). Every route is authenticated,
 * tenant-context-guarded, permission-checked server-side, and RLS-scoped. The
 * full workbench UI (WB1-1) consumes this; it is deliberately not shipped here.
 */
@ApiTags('People')
@Controller('people')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
@TenantScoped()
@ApiBearerAuth('JWT-auth')
export class PersonController {
  constructor(
    private readonly people: PersonService,
    private readonly merge: PersonMergeService,
    private readonly permissionService: PermissionService,
  ) {}

  private ctx(req: AuthenticatedRequest) {
    if (!req.user) throw new ForbiddenException('User context not found');
    return { tenantId: req.user.tenantId, userId: req.user.userId };
  }

  /** Whether the caller may see un-masked contact values. */
  private canViewContact(req: AuthenticatedRequest): boolean {
    return (
      !!req.userContext &&
      this.permissionService.checkPermissions(req.userContext, [
        'people.view_contact',
      ]).granted
    );
  }

  @Post()
  @RequirePermissions(['people.manage'])
  @ApiOperation({ summary: 'Create a person (a human; login optional)' })
  async create(@Body() dto: CreatePersonDto, @Request() req: AuthenticatedRequest) {
    const { tenantId, userId } = this.ctx(req);
    return this.people.create(tenantId, userId, dto);
  }

  @Get()
  @RequirePermissions(['people.view'])
  @ApiOperation({ summary: 'List/search people (contacts masked without people.view_contact)' })
  async list(@Query() query: SearchPeopleDto, @Request() req: AuthenticatedRequest) {
    const { tenantId } = this.ctx(req);
    return this.people.list(tenantId, query, this.canViewContact(req));
  }

  @Get(':id')
  @RequirePermissions(['people.view'])
  @ApiOperation({ summary: 'Get a person with profiles + relationships' })
  async get(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    const { tenantId } = this.ctx(req);
    return this.people.get(tenantId, id, this.canViewContact(req));
  }

  @Patch(':id')
  @RequirePermissions(['people.manage'])
  @ApiOperation({ summary: 'Update a person' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdatePersonDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, userId } = this.ctx(req);
    return this.people.update(tenantId, userId, id, dto);
  }

  @Post(':id/staff-profile')
  @RequirePermissions(['people.manage'])
  @ApiOperation({ summary: 'Attach a first-class staff/employment profile' })
  async addStaffProfile(
    @Param('id') id: string,
    @Body() dto: AddStaffProfileDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, userId } = this.ctx(req);
    return this.people.addStaffProfile(tenantId, userId, id, dto);
  }

  @Post(':id/guardianships')
  @RequirePermissions(['people.manage'])
  @ApiOperation({ summary: 'Make this person a guardian of a ward (student) person' })
  async addGuardianship(
    @Param('id') id: string,
    @Body() dto: AddGuardianshipDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, userId } = this.ctx(req);
    return this.people.addGuardianship(tenantId, userId, id, dto);
  }

  @Post(':id/contacts')
  @RequirePermissions(['people.manage'])
  @ApiOperation({ summary: 'Add a contact point (email/phone)' })
  async addContact(
    @Param('id') id: string,
    @Body() dto: AddContactPointDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, userId } = this.ctx(req);
    return this.people.addContact(tenantId, userId, id, dto);
  }

  @Post(':id/contacts/:contactId/verify')
  @RequirePermissions(['people.manage'])
  @ApiOperation({ summary: 'Issue a verification token for a contact' })
  async issueVerification(
    @Param('id') id: string,
    @Param('contactId') contactId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, userId } = this.ctx(req);
    return this.people.issueContactVerification(tenantId, userId, id, contactId);
  }

  @Post('contacts/confirm')
  @RequirePermissions(['people.manage'])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm a contact verification token' })
  async confirmVerification(
    @Body() dto: ConfirmContactDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, userId } = this.ctx(req);
    return this.people.confirmContactVerification(tenantId, userId, dto.token);
  }

  @Post('merge')
  // Dedup is high-risk: clearance 7 + audit + reversible history. Maker-checker
  // step-up is layered on in WB1-6 (which owns high-risk access workflows).
  @RequirePermissions(['people.merge'], PermissionMode.ALL, 7)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Merge a duplicate person into a survivor (history preserved)' })
  async mergePeople(
    @Body() dto: MergePeopleDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const { tenantId, userId } = this.ctx(req);
    return this.merge.merge(
      tenantId,
      userId,
      dto.survivorId,
      dto.duplicateId,
      dto.reason,
    );
  }
}
