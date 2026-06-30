/**
 * Verify MFA DTOs
 *
 * Data Transfer Objects for MFA verification operations (3a.6).
 */

import { IsString, IsOptional, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MfaMethodType } from '@workspace/api';
import type { AuthenticationResponseJSON } from '@simplewebauthn/server';

/**
 * Initiate MFA Verification Request
 */
export class InitiateMfaVerificationDto {
  @ApiPropertyOptional({ example: 'a1b2c3d4-e5f6-4789-9abc-def012345678', description: 'Optional, uses primary if not provided' })
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
  @ApiProperty({ example: 'a1b2c3d4-e5f6-4789-9abc-def012345678' })
  @IsString()
  challengeId: string;

  @ApiPropertyOptional({ example: '123456', description: 'For SMS/Email' })
  @IsString()
  @IsOptional()
  code?: string; // For SMS/Email

  @ApiPropertyOptional({ example: '654321', description: 'For TOTP' })
  @IsString()
  @IsOptional()
  token?: string; // For TOTP

  @ApiPropertyOptional({ description: 'For WebAuthn - assertion response object' })
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
