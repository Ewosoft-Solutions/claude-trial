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

/**
 * Setup SMS MFA Request
 */
export class SetupSmsMfaDto {
  @IsString()
  @Matches(/^\+?[1-9]\d{1,14}$/, {
    message: 'Phone number must be in E.164 format',
  })
  phoneNumber: string;

  @IsString()
  @IsOptional()
  name?: string;
}

/**
 * Setup Email MFA Request
 */
export class SetupEmailMfaDto {
  @IsEmail()
  emailAddress: string;

  @IsString()
  @IsOptional()
  name?: string;
}

/**
 * Setup TOTP MFA Request
 */
export class SetupTotpMfaDto {
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
  @IsString()
  methodId: string;

  @IsString()
  @IsOptional()
  code?: string;

  @IsString()
  @IsOptional()
  token?: string; // For TOTP

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
