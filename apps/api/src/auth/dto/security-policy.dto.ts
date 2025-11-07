/**
 * Security Policy DTOs
 *
 * DTOs for security policy management operations
 */

import {
  IsEnum,
  IsOptional,
  IsString,
  IsArray,
  IsBoolean,
  IsInt,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import type { PolicyTier, DeviceManagement, AuditLevel } from '@workspace/api';

export class TimeRestrictionDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => Object)
  allowedHours: Array<{ start: number; end: number }>;

  @IsArray()
  @IsString({ each: true })
  allowedDays: string[];
}

export class AssignPolicyDto {
  @IsEnum(['basic', 'enhanced', 'maximum'])
  tier: PolicyTier;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class ChangePolicyTierDto {
  @IsEnum(['basic', 'enhanced', 'maximum'])
  newTier: PolicyTier;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class SetEmergencyPolicyDto {
  @IsEnum(['basic', 'enhanced', 'maximum'])
  tier: PolicyTier;

  @IsString()
  reason: string;
}

export class UpdatePolicyDto {
  @IsOptional()
  @IsEnum(['basic', 'enhanced', 'maximum'])
  policyTier?: PolicyTier;

  @IsOptional()
  @IsBoolean()
  requireMFA?: boolean;

  @IsOptional()
  @IsBoolean()
  requireMFAForSensitiveOperations?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sensitiveOperations?: string[];

  @IsOptional()
  @IsInt()
  @Min(8)
  passwordMinLength?: number;

  @IsOptional()
  @IsBoolean()
  passwordRequireUppercase?: boolean;

  @IsOptional()
  @IsBoolean()
  passwordRequireLowercase?: boolean;

  @IsOptional()
  @IsBoolean()
  passwordRequireNumbers?: boolean;

  @IsOptional()
  @IsBoolean()
  passwordRequireSpecialChars?: boolean;

  @IsOptional()
  @IsInt()
  @Min(30)
  passwordMaxAge?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  passwordPreventReuse?: number;

  @IsOptional()
  @IsInt()
  @Min(5)
  sessionTimeout?: number;

  @IsOptional()
  @IsBoolean()
  requireMFAForSessionExtension?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxConcurrentSessions?: number;

  @IsOptional()
  @IsEnum(['none', 'basic', 'strict'])
  deviceManagement?: DeviceManagement;

  @IsOptional()
  @IsInt()
  @Min(1)
  loginAttemptLimit?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  lockoutDuration?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => TimeRestrictionDto)
  timeRestrictions?: TimeRestrictionDto | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  ipWhitelist?: string[] | null;

  @IsOptional()
  @IsBoolean()
  requireVPN?: boolean;

  @IsOptional()
  @IsEnum(['basic', 'standard', 'comprehensive'])
  auditLevel?: AuditLevel;

  @IsOptional()
  @IsInt()
  @Min(30)
  auditRetention?: number;
}
