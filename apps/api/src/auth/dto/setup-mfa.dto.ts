/**
 * Setup MFA DTOs
 *
 * Data Transfer Objects for MFA setup operations (3a.5).
 */

import {
  IsString,
  IsOptional,
  IsEmail,
  Matches,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Setup SMS MFA Request
 */
export class SetupSmsMfaDto {
  @ApiProperty({ example: '+15551234567', description: 'Phone number in E.164 format' })
  @IsString()
  @Matches(/^\+?[1-9]\d{1,14}$/, {
    message: 'Phone number must be in E.164 format',
  })
  phoneNumber: string;

  @ApiPropertyOptional({ example: 'My phone' })
  @IsString()
  @IsOptional()
  name?: string;
}

/**
 * Setup Email MFA Request
 */
export class SetupEmailMfaDto {
  @ApiProperty({ example: 'jane.doe@example.com' })
  @IsEmail()
  emailAddress: string;

  @ApiPropertyOptional({ example: 'My email' })
  @IsString()
  @IsOptional()
  name?: string;
}

/**
 * Setup TOTP MFA Request
 */
export class SetupTotpMfaDto {
  @ApiPropertyOptional({ example: 'Authenticator app' })
  @IsString()
  @IsOptional()
  name?: string;
}

/**
 * Setup TOTP MFA Response
 */
export class SetupTotpMfaResponseDto {
  methodId: string;
  qrCodeUrl: string;
  manualEntryKey: string;
}

/**
 * Verify and Activate MFA Request
 */
export class VerifyAndActivateMfaDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-4789-9abc-def012345678' })
  @IsString()
  methodId: string;

  @ApiPropertyOptional({ example: '123456', description: 'For SMS/Email MFA' })
  @IsString()
  @IsOptional()
  code?: string;

  @ApiPropertyOptional({ example: '654321', description: 'For TOTP' })
  @IsString()
  @IsOptional()
  token?: string; // For TOTP

  @ApiPropertyOptional({ description: 'For WebAuthn - registration response object' })
  @IsString()
  @IsOptional()
  registrationResponse?: any; // For WebAuthn
}

/**
 * Setup WebAuthn MFA Response
 */
export class SetupWebAuthnMfaResponseDto {
  challengeId: string;
  options: any; // WebAuthn registration options
}
