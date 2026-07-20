import { IsString, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty({ example: 'a1b2c3d4e5f67890abcdef1234567890abcdef1234567890abcdef12345678', description: 'Password reset token from the reset email' })
  @IsString()
  token: string;

  @ApiProperty({ example: 'NewPassw0rd!2025' })
  @IsString()
  @MinLength(8)
  newPassword: string;

  @ApiPropertyOptional({ example: '123456', description: 'MFA code for verification (required for enhanced security)' })
  @IsString()
  mfaCode?: string; // MFA code for verification (required for enhanced security)
}
