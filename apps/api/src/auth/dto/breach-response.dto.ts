/**
 * Breach Response DTOs
 *
 * Data transfer objects for breach response operations.
 */

import {
  IsString,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsUUID,
} from 'class-validator';
import { BreachSeverity } from '@workspace/api';

/**
 * Respond to Breach DTO
 */
export class RespondToBreachDto {
  @IsString()
  reason: string;

  @IsEnum(BreachSeverity)
  @IsOptional()
  severity?: BreachSeverity;

  @IsBoolean()
  @IsOptional()
  escalateToPasswordReset?: boolean;

  @IsBoolean()
  @IsOptional()
  enableEnhancedMonitoring?: boolean;

  @IsBoolean()
  @IsOptional()
  enableInvestigationMode?: boolean;
}

/**
 * Respond to School Breach DTO
 */
export class RespondToSchoolBreachDto extends RespondToBreachDto {
  @IsUUID()
  schoolId: string;
}

/**
 * Respond to Profile Breach DTO
 */
export class RespondToProfileBreachDto extends RespondToBreachDto {
  @IsUUID()
  profileId: string;
}

/**
 * Respond to Platform Breach DTO
 */
export class RespondToPlatformBreachDto {
  @IsString()
  reason: string;

  @IsEnum(BreachSeverity)
  @IsOptional()
  severity?: BreachSeverity;
}
