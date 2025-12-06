import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { JWTSecretRotationReason } from '@workspace/api';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import {
  ClearanceLevelGuard,
  RequireClearanceLevel,
} from '../../auth/guards/clearance-level.guard';
import {
  PermissionGuard,
  RequirePermissions,
} from '../../auth/guards/permission.guard';
import { TenantService } from '../services/tenant.service';
import { TenantRegistrationService } from '../services/tenant-registration.service';
import { TenantStatusService } from '../services/tenant-status.service';
import { TenantConfigurationService } from '../services/tenant-configuration.service';
import { UserInvitationService } from '../services/user-invitation.service';
import { UserManagementService } from '../services/user-management.service';
import { EmailDomainValidationService } from '../services/email-domain-validation.service';
import { JWTSecretRotationService } from '../services/jwt-secret-rotation.service';
import {
  RegisterTenantDto,
  UpdateTenantDto,
  UpdateTenantStatusDto,
  UpdateTenantConfigurationDto,
  ValidateEmailDomainDto,
  CreateInvitationDto,
  BulkCreateInvitationsDto,
  AcceptInvitationDto,
  CreateUserDto,
  BulkCreateUsersDto,
  AddUserToTenantDto,
  UpdateUserDto,
  UpdateUserProfileDto,
} from '../dto';

/**
 * Tenant Management Controller
 *
 * Handles all tenant (school) management operations.
 */
@ApiTags('tenant')
@Controller('tenant')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class TenantController {
  constructor(
    private readonly tenantService: TenantService,
    private readonly registrationService: TenantRegistrationService,
    private readonly statusService: TenantStatusService,
    private readonly configurationService: TenantConfigurationService,
    private readonly invitationService: UserInvitationService,
    private readonly userManagementService: UserManagementService,
    private readonly emailValidationService: EmailDomainValidationService,
    private readonly jwtRotationService: JWTSecretRotationService,
  ) {}

  /**
   * Register a new school (tenant)
   * 6.1: Implement school registration (platform admin or school owner)
   */
  @Post('register')
  @RequireClearanceLevel(8) // Owner or higher
  @ApiOperation({ summary: 'Register a new school (tenant)' })
  @ApiResponse({ status: 201, description: 'School registered successfully' })
  async registerTenant(@Body() data: RegisterTenantDto, @Request() req: any) {
    const user = req.user;
    const userContext = req.userContext;

    // Get requester role (highest clearance level role)
    const requesterRole = userContext?.roles?.[0]?.name || 'User';

    return this.registrationService.registerTenant(
      data,
      user.userId,
      requesterRole,
    );
  }

  /**
   * Get tenant by ID
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get tenant by ID' })
  async getTenant(@Param('id') id: string) {
    return this.tenantService.getTenant(id);
  }

  /**
   * List tenants
   */
  @Get()
  @RequireClearanceLevel(9) // SuperAdmin or higher
  @ApiOperation({ summary: 'List all tenants' })
  async listTenants(
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.tenantService.listTenants({
      status,
      search,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  /**
   * Update tenant
   */
  @Put(':id')
  @RequireClearanceLevel(8) // Owner or higher
  @ApiOperation({ summary: 'Update tenant information' })
  async updateTenant(
    @Param('id') id: string,
    @Body() data: UpdateTenantDto,
    @Request() req: any,
  ) {
    const user = req.user;
    return this.registrationService.updateTenant(id, data, user.userId);
  }

  /**
   * Update tenant status
   * 6.8: Implement tenant status management
   */
  @Patch(':id/status')
  @RequireClearanceLevel(9) // SuperAdmin or higher
  @ApiOperation({ summary: 'Update tenant status' })
  async updateTenantStatus(
    @Param('id') id: string,
    @Body() data: UpdateTenantStatusDto,
    @Request() req: any,
  ) {
    const user = req.user;
    return this.statusService.updateTenantStatus(id, data, user.userId);
  }

  /**
   * Get tenant configuration
   * 6.9: Create tenant settings/configuration API
   */
  @Get(':id/configuration')
  @ApiOperation({ summary: 'Get tenant configuration' })
  async getTenantConfiguration(@Param('id') id: string) {
    return this.configurationService.getTenantConfiguration(id);
  }

  /**
   * Update tenant configuration
   * 6.9: Create tenant settings/configuration API
   */
  @Put(':id/configuration')
  @RequireClearanceLevel(8) // Owner or higher
  @ApiOperation({ summary: 'Update tenant configuration' })
  async updateTenantConfiguration(
    @Param('id') id: string,
    @Body() data: UpdateTenantConfigurationDto,
    @Request() req: any,
  ) {
    const user = req.user;
    return this.configurationService.updateTenantConfiguration(
      id,
      data,
      user.userId,
    );
  }

  /**
   * Validate email domain
   * 6.3: Implement optional email domain validation (DNS TXT record)
   */
  @Post(':id/validate-email-domain')
  @RequireClearanceLevel(8) // Owner or higher
  @ApiOperation({ summary: 'Validate email domain using DNS TXT record' })
  async validateEmailDomain(
    @Param('id') id: string,
    @Body() data: ValidateEmailDomainDto,
  ) {
    return this.emailValidationService.validateEmailDomain(
      data.emailDomain,
      id,
    );
  }

  /**
   * Get verification TXT record
   * 6.3: Implement optional email domain validation (DNS TXT record)
   */
  @Get(':id/verification-txt-record')
  @ApiOperation({ summary: 'Get DNS TXT record for email domain verification' })
  async getVerificationTxtRecord(@Param('id') id: string) {
    return {
      txtRecord: this.emailValidationService.getVerificationTxtRecord(id),
      instructions: 'Add this TXT record to your domain DNS settings',
    };
  }

  /**
   * Create user invitation
   * 6.5: Implement user invitation system
   */
  @Post(':id/invitations')
  @RequireClearanceLevel(7) // Management or higher
  @ApiOperation({ summary: 'Create user invitation' })
  async createInvitation(
    @Param('id') tenantId: string,
    @Body() data: CreateInvitationDto,
    @Request() req: any,
  ) {
    const user = req.user;
    return this.invitationService.createInvitation(tenantId, data, user.userId);
  }

  /**
   * Bulk create invitations
   * 6.5: Implement user invitation system
   */
  @Post(':id/invitations/bulk')
  @RequireClearanceLevel(7) // Management or higher
  @ApiOperation({ summary: 'Bulk create user invitations' })
  async bulkCreateInvitations(
    @Param('id') tenantId: string,
    @Body() data: BulkCreateInvitationsDto,
    @Request() req: any,
  ) {
    const user = req.user;
    return this.invitationService.bulkCreateInvitations(
      tenantId,
      data,
      user.userId,
    );
  }

  /**
   * Accept invitation (public endpoint)
   * 6.5: Implement user invitation system
   */
  @Post('invitations/accept')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accept user invitation' })
  async acceptInvitation(@Body() data: AcceptInvitationDto) {
    return this.invitationService.acceptInvitation(data);
  }

  /**
   * Create user directly
   * 6.4: Implement admin-controlled user addition
   */
  @Post(':id/users')
  @RequireClearanceLevel(7) // Management or higher
  @ApiOperation({ summary: 'Create user directly (without invitation)' })
  async createUser(
    @Param('id') tenantId: string,
    @Body() data: CreateUserDto,
    @Request() req: any,
  ) {
    const user = req.user;
    return this.userManagementService.createUser(tenantId, data, user.userId);
  }

  /**
   * Bulk create users
   * 6.4: Implement admin-controlled user addition (bulk import)
   */
  @Post(':id/users/bulk')
  @RequireClearanceLevel(7) // Management or higher
  @ApiOperation({ summary: 'Bulk create users' })
  async bulkCreateUsers(
    @Param('id') tenantId: string,
    @Body() data: BulkCreateUsersDto,
    @Request() req: any,
  ) {
    const user = req.user;
    return this.userManagementService.bulkCreateUsers(
      tenantId,
      data,
      user.userId,
    );
  }

  /**
   * Add existing user to tenant
   * 6.4: Implement admin-controlled user addition
   */
  @Post(':id/users/add')
  @RequireClearanceLevel(7) // Management or higher
  @ApiOperation({ summary: 'Add existing user to tenant' })
  async addUserToTenant(
    @Param('id') tenantId: string,
    @Body() data: AddUserToTenantDto,
    @Request() req: any,
  ) {
    const user = req.user;
    return this.userManagementService.addUserToTenant(
      tenantId,
      data,
      user.userId,
    );
  }

  /**
   * Get user profiles for tenant
   * 6.10: Implement multi-school user management (profile-based)
   */
  @Get(':id/users')
  @RequireClearanceLevel(7) // Management or higher
  @ApiOperation({ summary: 'Get user profiles for tenant' })
  async getUserProfiles(
    @Param('id') tenantId: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.userManagementService.getUserProfiles(tenantId, {
      status,
      search,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  /**
   * Get user profile by ID (12.3)
   */
  @Get(':id/users/:profileId')
  @RequireClearanceLevel(7) // Management or higher
  @ApiOperation({ summary: 'Get user profile by ID' })
  async getUserProfile(
    @Param('id') tenantId: string,
    @Param('profileId') profileId: string,
  ) {
    return this.userManagementService.getUserProfile(tenantId, profileId);
  }

  /**
   * Update user (12.3)
   */
  @Put('users/:userId')
  @RequireClearanceLevel(7) // Management or higher
  @ApiOperation({ summary: 'Update user' })
  async updateUser(
    @Param('userId') userId: string,
    @Body() data: UpdateUserDto,
    @Request() req: any,
  ) {
    const user = req.user;
    return this.userManagementService.updateUser(userId, data, user.userId);
  }

  /**
   * Update user profile (12.3)
   */
  @Put(':id/users/:profileId')
  @RequireClearanceLevel(7) // Management or higher
  @ApiOperation({ summary: 'Update user profile' })
  async updateUserProfile(
    @Param('id') tenantId: string,
    @Param('profileId') profileId: string,
    @Body() data: UpdateUserProfileDto,
    @Request() req: any,
  ) {
    const user = req.user;
    return this.userManagementService.updateUserProfile(
      tenantId,
      profileId,
      data,
      user.userId,
    );
  }

  /**
   * Delete user profile (remove from tenant) (12.3)
   */
  @Delete(':id/users/:profileId')
  @RequireClearanceLevel(7) // Management or higher
  @ApiOperation({ summary: 'Delete user profile (remove from tenant)' })
  async deleteUserProfile(
    @Param('id') tenantId: string,
    @Param('profileId') profileId: string,
    @Request() req: any,
  ) {
    const user = req.user;
    return this.userManagementService.deleteUserProfile(
      tenantId,
      profileId,
      user.userId,
    );
  }

  /**
   * Rotate JWT secret
   * 6.12: Implement secret rotation
   * 6.13: Implement secret access controls (platform admin only)
   */
  @Post(':id/jwt-secret/rotate')
  @RequireClearanceLevel(9) // SuperAdmin or higher
  @ApiOperation({ summary: 'Rotate JWT secret (platform admin only)' })
  async rotateJWTSecret(
    @Param('id') tenantId: string,
    @Body()
    data: {
      reason: JWTSecretRotationReason;
      emergency?: boolean;
    },
    @Request() req: any,
  ) {
    const userContext = req.userContext;
    const requesterRole = userContext?.roles?.[0]?.name || 'User';
    return this.jwtRotationService.rotateSecret(tenantId, requesterRole, data);
  }

  /**
   * Emergency rotate JWT secret
   * 6.12: Implement secret rotation (emergency)
   * 6.13: Implement secret access controls (platform admin only)
   */
  @Post(':id/jwt-secret/rotate-emergency')
  @RequireClearanceLevel(9) // SuperAdmin or higher
  @ApiOperation({
    summary: 'Emergency rotate JWT secret (platform admin only)',
  })
  async emergencyRotateJWTSecret(
    @Param('id') tenantId: string,
    @Request() req: any,
  ) {
    const userContext = req.userContext;
    const requesterRole = userContext?.roles?.[0]?.name || 'User';
    return this.jwtRotationService.emergencyRotateSecret(
      tenantId,
      requesterRole,
    );
  }

  /**
   * Get JWT secret rotation status
   * 6.13: Implement secret access controls (platform admin only)
   */
  @Get(':id/jwt-secret/rotation-status')
  @RequireClearanceLevel(9) // SuperAdmin or higher
  @ApiOperation({
    summary: 'Get JWT secret rotation status (platform admin only)',
  })
  async getJWTSecretRotationStatus(
    @Param('id') tenantId: string,
    @Request() req: any,
  ) {
    const userContext = req.userContext;
    const requesterRole = userContext?.roles?.[0]?.name || 'User';
    return this.jwtRotationService.getSecretRotationStatus(
      tenantId,
      requesterRole,
    );
  }
}
