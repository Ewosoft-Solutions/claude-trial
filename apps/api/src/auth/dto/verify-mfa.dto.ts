/**
 * Verify MFA DTOs
 *
 * Data Transfer Objects for MFA verification operations (3a.6).
 */

import { IsString, IsOptional, IsObject } from 'class-validator';
import { MfaMethodType } from '@workspace/api';
import type { AuthenticationResponseJSON } from '@simplewebauthn/server';

/**
 * Initiate MFA Verification Request
 */
export class InitiateMfaVerificationDto {
  @IsString()
  @IsOptional()
  methodId?: string; // Optional, uses primary if not provided
}

/**
 * Initiate MFA Verification Response
 */
export class InitiateMfaVerificationResponseDto {
  challengeId: string;
  methodType: MfaMethodType;
  expiresAt: Date;
  qrCodeUrl?: string; // For TOTP
  webauthnOptions?: any; // For WebAuthn
}

/**
 * Verify MFA Challenge Request
 */
export class VerifyMfaChallengeDto {
  @IsString()
  challengeId: string;

  @IsString()
  @IsOptional()
  code?: string; // For SMS/Email

  @IsString()
  @IsOptional()
  token?: string; // For TOTP

  @IsObject()
  @IsOptional()
  webauthnResponse?: AuthenticationResponseJSON | null; // For WebAuthn
}

/**
 * Verify MFA Challenge Response
 */
export class VerifyMfaChallengeResponseDto {
  verified: boolean;
  challengeId: string;
}
