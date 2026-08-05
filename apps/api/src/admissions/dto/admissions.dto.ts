import {
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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

export class CreateApplicationDto {
  @ApiProperty({ example: 'Ngozi Achebe' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  applicantName!: string;

  @ApiProperty({ example: 'JSS 1', description: 'Target class/grade (label)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  applyingFor!: string;

  @ApiProperty({ example: 'Mrs. E. Achebe' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  guardianName!: string;

  @ApiPropertyOptional({ example: 'e.achebe@example.com' })
  @IsOptional()
  @IsEmail()
  guardianEmail?: string;

  @ApiPropertyOptional({ example: '+234-801-234-5678' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  guardianPhone?: string;

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
