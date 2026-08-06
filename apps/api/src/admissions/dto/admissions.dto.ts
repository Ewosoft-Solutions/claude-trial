import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  APPLICANT_GENDERS,
  COLLECT_STAGES,
  GUARDIAN_RELATIONSHIPS,
  REQUIREMENT_TYPES,
} from '../admission-requirements.constants';

// WB3-1: the real admissions stage machine (was strings-only
// application|interview|decision). Legacy 'interview' survives; the rest are new.
export const ADMISSION_STAGES = [
  'enquiry',
  'applied',
  'screening',
  'interview',
  'offer',
  'accepted',
  'enrolled',
  'rejected',
  'withdrawn',
] as const;
export const APPLICATION_DECISIONS = [
  'pending',
  'accepted',
  'waitlisted',
  'rejected',
] as const;
export const REVIEW_RECOMMENDATIONS = [
  'recommend',
  'waitlist',
  'reject',
  'hold',
] as const;

export type AdmissionStage = (typeof ADMISSION_STAGES)[number];
export type ApplicationDecision = (typeof APPLICATION_DECISIONS)[number];

/**
 * WB3 structured-intake · a guardian on an application. Phone + WhatsApp are
 * captured with a country code; `whatsappSameAsPhone` reuses the phone as the
 * WhatsApp number so the parent doesn't re-type it.
 */
export class GuardianInputDto {
  @ApiProperty({ example: 'Mrs. Ebele Achebe' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  fullName!: string;

  @ApiProperty({ enum: GUARDIAN_RELATIONSHIPS, example: 'mother' })
  @IsIn(GUARDIAN_RELATIONSHIPS)
  relationship!: (typeof GUARDIAN_RELATIONSHIPS)[number];

  @ApiPropertyOptional({ example: 'e.achebe@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '12 Awolowo Road, Ikoyi, Lagos' })
  @IsOptional()
  @IsString()
  @MaxLength(240)
  address?: string;

  @ApiPropertyOptional({ example: '+234', default: '+234' })
  @IsOptional()
  @IsString()
  @MaxLength(8)
  phoneCountryCode?: string;

  @ApiProperty({ example: '801 234 5678' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  phoneNumber!: string;

  @ApiPropertyOptional({
    default: true,
    description: 'Reuse the phone number as the WhatsApp number.',
  })
  @IsOptional()
  @IsBoolean()
  whatsappSameAsPhone?: boolean;

  @ApiPropertyOptional({ example: '+234' })
  @IsOptional()
  @IsString()
  @MaxLength(8)
  whatsappCountryCode?: string;

  @ApiPropertyOptional({ example: '801 234 5678' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  whatsappNumber?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

export class CreateApplicationDto {
  @ApiProperty({ example: 'Ngozi Achebe' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  applicantName!: string;

  // ---- Structured "applying for" (WB2-1 academic structure) ----
  @ApiProperty({
    description:
      'The class (year level) the applicant is applying for. The stored ' +
      '"applying for" label is COMPOSED from this + stream server-side.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  yearLevelId!: string;

  @ApiPropertyOptional({
    description: 'The level (stage) of the year level — validated if provided.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  stageId?: string;

  @ApiPropertyOptional({
    description: 'The department (stream) — senior classes only.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  streamId?: string;

  @ApiPropertyOptional({ description: 'Target campus (multi-campus schools).' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  campusId?: string;

  // ---- Applicant profile ----
  @ApiPropertyOptional({ example: '2014-09-01' })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional({ enum: APPLICANT_GENDERS })
  @IsOptional()
  @IsIn(APPLICANT_GENDERS)
  gender?: (typeof APPLICANT_GENDERS)[number];

  @ApiPropertyOptional({ example: 'Anambra' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  stateOfOrigin?: string;

  @ApiPropertyOptional({ example: 'Christianity' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  religion?: string;

  @ApiPropertyOptional({ example: 'Mild asthma — carries an inhaler.' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  healthNotes?: string;

  // ---- Guardians (structured, multi) ----
  @ApiProperty({ type: [GuardianInputDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => GuardianInputDto)
  guardians!: GuardianInputDto[];

  @ApiPropertyOptional({ example: '2025-03-12' })
  @IsOptional()
  @IsDateString()
  submittedDate?: string;

  @ApiPropertyOptional({ example: 'Sibling already enrolled in SSS 2' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class UpdateApplicationDto {
  @ApiPropertyOptional({ example: 'Strong interview; recommended' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class AdvanceStageDto {
  @ApiProperty({ enum: ADMISSION_STAGES, example: 'screening' })
  @IsIn(ADMISSION_STAGES)
  toStage!: AdmissionStage;

  @ApiPropertyOptional({ example: 'Docs verified; moving to screening' })
  @IsOptional()
  @IsString()
  @MaxLength(240)
  note?: string;
}

export class AddReviewDto {
  @ApiPropertyOptional({ example: 82, minimum: 0, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  score?: number;

  @ApiProperty({ enum: REVIEW_RECOMMENDATIONS, example: 'recommend' })
  @IsIn(REVIEW_RECOMMENDATIONS)
  recommendation!: (typeof REVIEW_RECOMMENDATIONS)[number];

  @ApiPropertyOptional({ example: 'Strong entrance-test result' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class MakeOfferDto {
  @ApiPropertyOptional({ description: 'The section the offer is for (WB2-1)' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  targetClassSectionId?: string;

  @ApiPropertyOptional({ description: 'The academic year of the offer' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  academicYearId?: string;

  @ApiPropertyOptional({ example: 'Offer valid for 14 days' })
  @IsOptional()
  @IsString()
  @MaxLength(240)
  note?: string;
}

export class DecisionNoteDto {
  @ApiPropertyOptional({ example: 'Below the admission threshold' })
  @IsOptional()
  @IsString()
  @MaxLength(240)
  note?: string;
}

export class ConvertToStudentDto {
  @ApiProperty({
    description: 'The class section to enrol the new student into',
  })
  @IsString()
  @MaxLength(64)
  classSectionId!: string;

  @ApiProperty({ description: 'The academic year of the enrolment' })
  @IsString()
  @MaxLength(64)
  academicYearId!: string;
}

export class ListApplicationsDto {
  @ApiPropertyOptional({ enum: ADMISSION_STAGES, example: 'screening' })
  @IsOptional()
  @IsIn(ADMISSION_STAGES)
  stage?: AdmissionStage;

  @ApiPropertyOptional({ enum: APPLICATION_DECISIONS, example: 'pending' })
  @IsOptional()
  @IsIn(APPLICATION_DECISIONS)
  decision?: ApplicationDecision;

  @ApiPropertyOptional({ example: 'JSS 1' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  applyingFor?: string;

  @ApiPropertyOptional({
    example: 'Achebe',
    description: 'Free-text search across applicant + guardian name',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  query?: string;
}

// ======================= WB3 requirements framework =======================

/** Provide (fulfil) a requirement with a typed value (field/measurement/fee). */
export class ProvideRequirementDto {
  @ApiPropertyOptional({
    description:
      'Typed value for a field/measurement/fee requirement, e.g. ' +
      '{ height_cm: 132 } or { paid: true, reference: "PSK-3312" }.',
  })
  @IsOptional()
  @IsObject()
  value?: Record<string, unknown>;

  @ApiPropertyOptional({ example: 'Paid at the front desk (receipt #3312).' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

/** Waive a requirement (with a reason kept for audit). */
export class WaiveRequirementDto {
  @ApiProperty({ example: 'Fresh entrant — no previous school.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}

/** Upload a document to fulfil a document requirement (bytes base64-encoded). */
export class UploadRequirementDocumentDto {
  @ApiProperty({ example: 'image/jpeg' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  mime!: string;

  @ApiPropertyOptional({ example: 'passport.jpg' })
  @IsOptional()
  @IsString()
  @MaxLength(240)
  filename?: string;

  @ApiProperty({ description: 'File bytes, base64-encoded.' })
  @IsString()
  @IsNotEmpty()
  contentBase64!: string;
}

/** Create a requirement in the tenant's template. */
export class CreateRequirementDto {
  @ApiProperty({ example: 'guardian_id' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  key!: string;

  @ApiProperty({ example: 'Parent / guardian ID' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  label!: string;

  @ApiProperty({ enum: REQUIREMENT_TYPES })
  @IsIn(REQUIREMENT_TYPES)
  type!: (typeof REQUIREMENT_TYPES)[number];

  @ApiProperty({ enum: COLLECT_STAGES })
  @IsIn(COLLECT_STAGES)
  collectStage!: (typeof COLLECT_STAGES)[number];

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  order?: number;

  @ApiPropertyOptional({ description: 'Type-specific config (accept, fields…).' })
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}

/** Update a requirement in the template (all fields optional). */
export class UpdateRequirementDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  label?: string;

  @ApiPropertyOptional({ enum: COLLECT_STAGES })
  @IsOptional()
  @IsIn(COLLECT_STAGES)
  collectStage?: (typeof COLLECT_STAGES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  order?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}
