/**
 * Authentication Module
 *
 * Module for authentication functionality.
 */

import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthenticationService } from './services/authentication.service';
import { PasswordResetService } from './services/password-reset.service';
import { AuthJWTService } from './services/jwt.service';
import { JwtAuthGuard, TenantContextGuard } from './guards';

/**
 * Authentication Module
 *
 * Provides authentication services, controllers, and guards.
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
  controllers: [AuthController],
  providers: [
    AuthenticationService,
    PasswordResetService,
    AuthJWTService,
    JwtAuthGuard,
    TenantContextGuard,
  ],
  exports: [
    AuthenticationService,
    PasswordResetService,
    AuthJWTService,
    JwtAuthGuard,
    TenantContextGuard,
  ],
})
export class AuthModule {}
