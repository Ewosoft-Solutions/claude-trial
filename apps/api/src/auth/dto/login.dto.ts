import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(1)
  password: string;
}

/**
 * Verify MFA for Login DTO
 */
export class VerifyMfaForLoginDto {
  @IsString()
  challengeId: string;

  @IsString()
  @IsOptional()
  code?: string; // For SMS/Email

  @IsString()
  @IsOptional()
  token?: string; // For TOTP

  @IsString()
  @IsOptional()
  webauthnResponse?: any; // For WebAuthn

  @IsString()
  @IsOptional()
  recoveryCode?: string; // For recovery codes
}
