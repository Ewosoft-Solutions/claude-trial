import { IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty({ example: 'a1b2c3d4e5f67890abcdef1234567890abcdef1234567890abcdef12345678', description: 'Password reset token from the reset email' })
  @IsString()
  token: string;

  @ApiProperty({ example: 'NewPassw0rd!2025' })
  @IsString()
  @MinLength(8)
  newPassword: string;

  // Optional in fact as well as in name: the bootstrap flow (an Architect
  // claiming an account that has no MFA enrolled) omits it entirely. Without
  // @IsOptional the bare @IsString rejected the omitted field outright, so the
  // only way through was to send an empty string.
  @ApiPropertyOptional({ example: '123456', description: 'MFA code for verification (required for enhanced security)' })
  @IsOptional()
  @IsString()
  mfaCode?: string;
}
