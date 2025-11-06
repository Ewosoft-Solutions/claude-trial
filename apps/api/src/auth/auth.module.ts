/**
 * Authentication Module
 *
 * Module for authentication functionality.
 */

import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { MfaController } from './mfa.controller';
import { AuthenticationService } from './services/authentication.service';
import { PasswordResetService } from './services/password-reset.service';
import { AuthJWTService } from './services/jwt.service';
import { MfaService } from './services/mfa.service';
import { MfaSmsService } from './services/mfa-sms.service';
import { MfaEmailService } from './services/mfa-email.service';
import { MfaTotpService } from './services/mfa-totp.service';
import { MfaWebAuthnService } from './services/mfa-webauthn.service';
import { MfaAuditService } from './services/mfa-audit.service';
import { JwtAuthGuard, TenantContextGuard, MfaRequiredGuard } from './guards';
import {
  ClearanceLevelGuard,
  PermissionGuard,
  ContextValidationGuard,
} from './guards';
import {
  PermissionService,
  RoleService,
  PermissionPoolService,
  MakerCheckerService,
  PlatformOversightService,
} from './services';

/**
 * Authentication Module
 *
 * Provides authentication services, controllers, and guards.
 * Also includes authorization services and guards.
 */
@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      // Global JWT configuration
      // Note: Actual secrets are school-specific and retrieved at runtime
      secret: 'placeholder', // This will be overridden by school-specific secrets
      signOptions: {
        expiresIn: '1h',
      },
    }),
  ],
  controllers: [AuthController, MfaController],
  providers: [
    // Authentication services
    AuthenticationService,
    PasswordResetService,
    AuthJWTService,
    MfaService,
    MfaSmsService,
    MfaEmailService,
    MfaTotpService,
    MfaWebAuthnService,
    MfaAuditService,
    // Authorization services
    PermissionService,
    RoleService,
    PermissionPoolService,
    MakerCheckerService,
    PlatformOversightService,
    // Guards
    JwtAuthGuard,
    TenantContextGuard,
    MfaRequiredGuard,
    ClearanceLevelGuard,
    PermissionGuard,
    ContextValidationGuard,
  ],
  exports: [
    // Authentication services
    AuthenticationService,
    PasswordResetService,
    AuthJWTService,
    MfaService,
    MfaAuditService,
    // Authorization services
    PermissionService,
    RoleService,
    PermissionPoolService,
    MakerCheckerService,
    PlatformOversightService,
    // Guards
    JwtAuthGuard,
    TenantContextGuard,
    MfaRequiredGuard,
    ClearanceLevelGuard,
    PermissionGuard,
    ContextValidationGuard,
  ],
})
export class AuthModule {}
