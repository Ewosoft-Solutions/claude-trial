import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/**
 * WB1-2 staff-employment request bodies. Validation follows the H4 field-type
 * rule table: bounded strings, an enum for the small controlled vocabularies,
 * and a plausible year range for qualifications.
 */

export const EMPLOYMENT_TYPES = [
  'full_time',
  'part_time',
  'contract',
  'volunteer',
] as const;

// Status the office can SET directly. 'terminated' is reached through the
// dedicated disable endpoint (it also records an end date + reason).
export const SETTABLE_EMPLOYMENT_STATUS = [
  'active',
  'on_leave',
  'suspended',
] as const;

export const QUALIFICATION_TYPES = [
  'degree',
  'diploma',
  'certificate',
  'license',
  'other',
] as const;

// ISO-8601 calendar date (YYYY-MM-DD) — the office enters a date, not a moment.
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export class CreateEmploymentDto {
  @ApiPropertyOptional({ description: 'Job title / position, e.g. "Bursar"' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  jobTitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  department?: string;

  @ApiPropertyOptional({ enum: EMPLOYMENT_TYPES })
  @IsOptional()
  @IsIn(EMPLOYMENT_TYPES)
  employmentType?: (typeof EMPLOYMENT_TYPES)[number];

  @ApiPropertyOptional({
    description: 'Employee/staff number (unique per school)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  employeeNumber?: string;

  @ApiPropertyOptional({ description: 'Hire date (YYYY-MM-DD)' })
  @IsOptional()
  @Matches(ISO_DATE, { message: 'hireDate must be YYYY-MM-DD' })
  hireDate?: string;

  @ApiPropertyOptional({
    description: "This employment's manager (a StaffProfile id)",
  })
  @IsOptional()
  @IsUUID()
  reportsToStaffProfileId?: string;
}

export class UpdateEmploymentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  jobTitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  department?: string;

  @ApiPropertyOptional({ enum: EMPLOYMENT_TYPES })
  @IsOptional()
  @IsIn(EMPLOYMENT_TYPES)
  employmentType?: (typeof EMPLOYMENT_TYPES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  employeeNumber?: string;

  @ApiPropertyOptional({ description: 'Hire date (YYYY-MM-DD)' })
  @IsOptional()
  @Matches(ISO_DATE, { message: 'hireDate must be YYYY-MM-DD' })
  hireDate?: string;

  @ApiPropertyOptional({ enum: SETTABLE_EMPLOYMENT_STATUS })
  @IsOptional()
  @IsIn(SETTABLE_EMPLOYMENT_STATUS)
  employmentStatus?: (typeof SETTABLE_EMPLOYMENT_STATUS)[number];

  @ApiPropertyOptional({
    description:
      "Manager's StaffProfile id, or null to clear the reporting line",
    nullable: true,
  })
  @IsOptional()
  @IsUUID()
  reportsToStaffProfileId?: string | null;
}

export class DisableEmploymentDto {
  @ApiPropertyOptional({
    description: 'End date (YYYY-MM-DD); defaults to today',
  })
  @IsOptional()
  @Matches(ISO_DATE, { message: 'endDate must be YYYY-MM-DD' })
  endDate?: string;

  @ApiPropertyOptional({ example: 'Resigned' })
  @IsOptional()
  @IsString()
  @MaxLength(240)
  reason?: string;
}

export class AddQualificationDto {
  @ApiProperty({ example: 'B.Sc Mathematics' })
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  title: string;

  @ApiPropertyOptional({ enum: QUALIFICATION_TYPES })
  @IsOptional()
  @IsIn(QUALIFICATION_TYPES)
  qualificationType?: (typeof QUALIFICATION_TYPES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  institution?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  fieldOfStudy?: string;

  @ApiPropertyOptional({ minimum: 1900, maximum: 2100 })
  @IsOptional()
  @IsInt()
  @Min(1900)
  @Max(2100)
  awardedYear?: number;

  @ApiPropertyOptional({ description: 'F4 Document id holding proof' })
  @IsOptional()
  @IsUUID()
  documentId?: string;
}
