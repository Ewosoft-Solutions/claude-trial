/**
 * Recovery MFA DTOs
 *
 * Data Transfer Objects for MFA recovery operations (3a.7, 3a.8).
 */

import { IsString, IsInt, Min, Max, IsOptional } from 'class-validator';

/**
 * Generate Recovery Codes Request
 */
export class GenerateRecoveryCodesDto {
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
  @IsString()
  code: string;
}

/**
 * Verify Recovery Code Response
 */
export class VerifyRecoveryCodeResponseDto {
  verified: boolean;
}
