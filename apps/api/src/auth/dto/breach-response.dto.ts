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
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BreachSeverity } from '@workspace/api';

/**
 * Respond to Breach DTO
 */
export class RespondToBreachDto {
  @ApiProperty({ example: 'Suspicious login activity detected from multiple locations' })
  @IsString()
  reason: string;

  @ApiPropertyOptional({ enum: BreachSeverity, example: BreachSeverity.HIGH })
  @IsEnum(BreachSeverity)
  @IsOptional()
  severity?: BreachSeverity;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  escalateToPasswordReset?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  enableEnhancedMonitoring?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsBoolean()
  @IsOptional()
  enableInvestigationMode?: boolean;
}

/**
 * Respond to School Breach DTO
 */
export class RespondToSchoolBreachDto extends RespondToBreachDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-4789-9abc-def012345678' })
  @IsUUID()
  schoolId: string;
}

/**
 * Respond to Profile Breach DTO
 */
export class RespondToProfileBreachDto extends RespondToBreachDto {
  @ApiProperty({ example: 'c2d3e4f5-a6b7-4890-9bcd-ef0123456789' })
  @IsUUID()
  profileId: string;
}

/**
 * Respond to Platform Breach DTO
 */
export class RespondToPlatformBreachDto {
  @ApiProperty({ example: 'Coordinated credential stuffing attack detected platform-wide' })
  @IsString()
  reason: string;

  @ApiPropertyOptional({ enum: BreachSeverity, example: BreachSeverity.CRITICAL })
  @IsEnum(BreachSeverity)
  @IsOptional()
  severity?: BreachSeverity;
}
