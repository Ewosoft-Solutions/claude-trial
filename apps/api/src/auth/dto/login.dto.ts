import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'jane.doe@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Passw0rd!2025' })
  @IsString()
  @MinLength(1)
  password: string;
}

/**
 * Verify MFA for Login DTO
 */
export class VerifyMfaForLoginDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-4789-9abc-def012345678', description: 'Challenge ID returned from the login response' })
  @IsString()
  challengeId: string;

  @ApiPropertyOptional({ example: '123456', description: 'For SMS/Email MFA' })
  @IsString()
  @IsOptional()
  code?: string; // For SMS/Email

  @ApiPropertyOptional({ example: '654321', description: 'For TOTP MFA' })
  @IsString()
  @IsOptional()
  token?: string; // For TOTP

  @ApiPropertyOptional({ description: 'For WebAuthn MFA - assertion response object' })
  @IsString()
  @IsOptional()
  webauthnResponse?: any; // For WebAuthn

  @ApiPropertyOptional({ example: 'XJ4K-9PQR-2M7S', description: 'For recovery codes' })
  @IsString()
  @IsOptional()
  recoveryCode?: string; // For recovery codes
}
