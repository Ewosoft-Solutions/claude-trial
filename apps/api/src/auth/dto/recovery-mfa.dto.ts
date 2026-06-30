/**
 * Recovery MFA DTOs
 *
 * Data Transfer Objects for MFA recovery operations (3a.7, 3a.8).
 */

import { IsString, IsInt, Min, Max, IsOptional } from 'class-validator';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';

/**
 * Generate Recovery Codes Request
 */
export class GenerateRecoveryCodesDto {
  @ApiPropertyOptional({ example: 10, description: 'Number of recovery codes to generate (5-20). Default: 10' })
  @IsInt()
  @Min(5)
  @Max(20)
  @IsOptional()
  count?: number; // Default: 10
}

/**
 * Generate Recovery Codes Response
 */
export class GenerateRecoveryCodesResponseDto {
  codes: string[]; // Plain text codes - show to user once
  message: string;
}

/**
 * Verify Recovery Code Request
 */
export class VerifyRecoveryCodeDto {
  @ApiProperty({ example: 'XJ4K-9PQR-2M7S' })
  @IsString()
  code: string;
}

/**
 * Verify Recovery Code Response
 */
export class VerifyRecoveryCodeResponseDto {
  verified: boolean;
}
