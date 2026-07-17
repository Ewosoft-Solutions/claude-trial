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
  IsIn,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { PolicyTier, DeviceManagement, AuditLevel } from '@workspace/api';
import {
  STEP_UP_OPERATION_VALUES,
  type StepUpOperation,
} from '../step-up.operations';

export class TimeRestrictionDto {
  @ApiProperty({
    example: [{ start: 6, end: 22 }],
    description: 'Allowed hour ranges (24h clock)',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => Object)
  allowedHours: Array<{ start: number; end: number }>;

  @ApiProperty({
    example: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
  })
  @IsArray()
  @IsString({ each: true })
  allowedDays: string[];
}

export class AssignPolicyDto {
  @ApiProperty({ enum: ['basic', 'enhanced', 'maximum'], example: 'enhanced' })
  @IsEnum(['basic', 'enhanced', 'maximum'])
  tier: PolicyTier;

  @ApiPropertyOptional({ example: 'Elevated due to admin role' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class ChangePolicyTierDto {
  @ApiProperty({ enum: ['basic', 'enhanced', 'maximum'], example: 'maximum' })
  @IsEnum(['basic', 'enhanced', 'maximum'])
  newTier: PolicyTier;

  @ApiPropertyOptional({ example: 'Upgrading after security incident review' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class SetEmergencyPolicyDto {
  @ApiProperty({ enum: ['basic', 'enhanced', 'maximum'], example: 'maximum' })
  @IsEnum(['basic', 'enhanced', 'maximum'])
  tier: PolicyTier;

  @ApiProperty({ example: 'Active security incident - emergency lockdown' })
  @IsString()
  reason: string;
}

export class UpdatePolicyDto {
  @ApiPropertyOptional({
    enum: ['basic', 'enhanced', 'maximum'],
    example: 'enhanced',
  })
  @IsOptional()
  @IsEnum(['basic', 'enhanced', 'maximum'])
  policyTier?: PolicyTier;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  requireMFA?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  requireMFAForSensitiveOperations?: boolean;

  @ApiPropertyOptional({
    example: ['delete_student_record', 'export_financial_data'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sensitiveOperations?: string[];

  @ApiPropertyOptional({ example: 12 })
  @IsOptional()
  @IsInt()
  @Min(8)
  passwordMinLength?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  passwordRequireUppercase?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  passwordRequireLowercase?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  passwordRequireNumbers?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  passwordRequireSpecialChars?: boolean;

  @ApiPropertyOptional({
    example: 90,
    description: 'Maximum password age in days',
  })
  @IsOptional()
  @IsInt()
  @Min(30)
  passwordMaxAge?: number;

  @ApiPropertyOptional({
    example: 5,
    description: 'Number of previous passwords to prevent reuse of',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  passwordPreventReuse?: number;

  @ApiPropertyOptional({
    example: 30,
    description: 'Session timeout in minutes',
  })
  @IsOptional()
  @IsInt()
  @Min(5)
  sessionTimeout?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  requireMFAForSessionExtension?: boolean;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxConcurrentSessions?: number;

  @ApiPropertyOptional({ enum: ['none', 'basic', 'strict'], example: 'strict' })
  @IsOptional()
  @IsEnum(['none', 'basic', 'strict'])
  deviceManagement?: DeviceManagement;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  loginAttemptLimit?: number;

  @ApiPropertyOptional({
    example: 15,
    description: 'Lockout duration in minutes',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  lockoutDuration?: number;

  @ApiPropertyOptional({ type: TimeRestrictionDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => TimeRestrictionDto)
  timeRestrictions?: TimeRestrictionDto | null;

  @ApiPropertyOptional({
    example: ['203.0.113.10', '198.51.100.0/24'],
    nullable: true,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  ipWhitelist?: string[] | null;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  requireVPN?: boolean;

  @ApiPropertyOptional({
    enum: ['basic', 'standard', 'comprehensive'],
    example: 'comprehensive',
  })
  @IsOptional()
  @IsEnum(['basic', 'standard', 'comprehensive'])
  auditLevel?: AuditLevel;

  @ApiPropertyOptional({
    example: 365,
    description: 'Audit log retention in days',
  })
  @IsOptional()
  @IsInt()
  @Min(30)
  auditRetention?: number;
}

export class UpdateSessionPolicyDto {
  @ApiProperty({
    example: 15,
    minimum: 5,
    maximum: 120,
    description:
      'Minutes of real-user inactivity before the warning countdown begins',
  })
  @IsInt()
  @Min(5)
  @Max(120)
  idleTimeoutMinutes: number;
}

export const BIOMETRIC_ENROLLMENT_POLICIES = [
  'require',
  'allow',
  'forbid',
] as const;
export type BiometricEnrollmentPolicy =
  (typeof BIOMETRIC_ENROLLMENT_POLICIES)[number];

export class UpdateBiometricEnrollmentPolicyDto {
  @ApiProperty({ enum: BIOMETRIC_ENROLLMENT_POLICIES })
  @IsIn(BIOMETRIC_ENROLLMENT_POLICIES)
  policy: BiometricEnrollmentPolicy;
}

export class UpdateSensitiveOperationPolicyDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  requiresStepUp?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  requiresMakerChecker?: boolean;

  @ApiPropertyOptional({ minimum: 1, maximum: 30 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  freshnessMinutes?: number;
}

export class CreateSensitiveOperationChangeRequestDto extends UpdateSensitiveOperationPolicyDto {
  @ApiProperty({ enum: STEP_UP_OPERATION_VALUES })
  @IsString()
  @IsIn(STEP_UP_OPERATION_VALUES)
  operation: StepUpOperation;

  @ApiProperty({ minLength: 10, maxLength: 1000 })
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  reason: string;
}

export const SENSITIVE_OPERATION_DECISIONS = ['approved', 'rejected'] as const;

export class ReviewSensitiveOperationChangeRequestDto {
  @ApiProperty({ enum: SENSITIVE_OPERATION_DECISIONS })
  @IsIn(SENSITIVE_OPERATION_DECISIONS)
  decision: (typeof SENSITIVE_OPERATION_DECISIONS)[number];

  @ApiProperty({ minLength: 3, maxLength: 1000 })
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  feedback: string;
}
