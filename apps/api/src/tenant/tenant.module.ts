import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TenantController } from './controllers/tenant.controller';
import { TenantConfigurationController } from './controllers/tenant-configuration.controller';
import { TenantFeaturesController } from './controllers/tenant-features.controller';
import { PublicTenantController } from './controllers/public-tenant.controller';
import { TenantService } from './services/tenant.service';
import { TenantRegistrationService } from './services/tenant-registration.service';
import { TenantStatusService } from './services/tenant-status.service';
import { TenantConfigurationService } from './services/tenant-configuration.service';
import { UserInvitationService } from './services/user-invitation.service';
import { UserManagementService } from './services/user-management.service';
import { EmailDomainValidationService } from './services/email-domain-validation.service';
import { TenantAuditService } from './services/tenant-audit.service';
import { JWTSecretRotationService } from './services/jwt-secret-rotation.service';
import { PlatformApprovalService } from './services/platform-approval.service';
import { CommonModule } from '../common';
import { AuthModule } from '../auth/auth.module';

/**
 * Tenant Management Module
 *
 * Provides tenant (school) management functionality including:
 * - School registration
 * - Tenant status management
 * - Tenant configuration
 * - User invitation system
 * - User management (direct creation, invitation, bulk import)
 * - Email domain validation
 * - Audit logging
 */
@Module({
  imports: [
    CommonModule,
    AuthModule,
    JwtModule.register({
      secret: 'placeholder',
      signOptions: { expiresIn: '1h' },
    }),
  ],
  controllers: [
    TenantConfigurationController,
    TenantFeaturesController,
    TenantController,
    PublicTenantController,
  ],
  providers: [
    TenantService,
    TenantRegistrationService,
    TenantStatusService,
    TenantConfigurationService,
    UserInvitationService,
    UserManagementService,
    EmailDomainValidationService,
    TenantAuditService,
    JWTSecretRotationService,
    PlatformApprovalService,
  ],
  exports: [
    TenantService,
    TenantRegistrationService,
    TenantStatusService,
    TenantConfigurationService,
    UserInvitationService,
    UserManagementService,
    EmailDomainValidationService,
    TenantAuditService,
    JWTSecretRotationService,
  ],
})
export class TenantModule {}
