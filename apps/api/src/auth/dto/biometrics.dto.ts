/**
 * Biometrics DTOs
 *
 * Data Transfer Objects for platform-authenticator (passkey / Face ID /
 * fingerprint) enrolment and device management (Biometrics Phase 1).
 */

import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Verify Biometric Registration Request
 *
 * Sent after the browser has produced a credential via
 * `navigator.credentials.create()` / `@simplewebauthn/browser`.
 */
export class VerifyBiometricRegistrationDto {
  @ApiProperty({ description: 'Challenge id returned from register/options' })
  @IsString()
  challengeId: string;

  @ApiProperty({ description: 'WebAuthn attestation response from the client' })
  @IsObject()
  registrationResponse: Record<string, unknown>;

  @ApiPropertyOptional({
    example: 'My iPhone',
    description: 'User-friendly label for the enrolled device',
  })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  label?: string;
}

/**
 * Rename an enrolled biometric device.
 */
export class RenameBiometricDeviceDto {
  @ApiProperty({ example: 'iPhone 16 Pro Max' })
  @IsString()
  @MaxLength(60)
  label: string;
}
