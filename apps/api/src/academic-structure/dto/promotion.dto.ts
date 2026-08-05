/**
 * DTOs for the WB2-4 promotion workbench — create a year-rollover run, preview
 * the cohort with proposed placements, mark per-student exceptions, then request
 * + approve the maker-checker-gated commit. class-validator decorators satisfy
 * the global whitelist + forbidNonWhitelisted pipe.
 */
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const PROMOTION_DECISIONS = [
  'promote',
  'repeat',
  'withhold',
  'manual',
] as const;

export class CreatePromotionRunDto {
  @ApiProperty({ example: 'SS1 → SS2 (2026/27 → 2027/28)' })
  @IsString()
  @MaxLength(160)
  name: string;

  @ApiProperty({ description: 'The academic year the cohort is promoted FROM' })
  @IsString()
  @MaxLength(64)
  fromAcademicYearId: string;

  @ApiProperty({ description: 'The academic year the cohort is promoted TO' })
  @IsString()
  @MaxLength(64)
  toAcademicYearId: string;

  @ApiProperty({ description: 'The year level being promoted FROM' })
  @IsString()
  @MaxLength(64)
  fromYearLevelId: string;

  @ApiProperty({ description: 'The year level being promoted TO' })
  @IsString()
  @MaxLength(64)
  toYearLevelId: string;

  @ApiPropertyOptional({
    description: 'Scope the run to a campus (omit = tenant-wide)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  campusId?: string;
}

export class SetPromotionExceptionDto {
  @ApiProperty({ enum: PROMOTION_DECISIONS })
  @IsIn(PROMOTION_DECISIONS)
  decision: (typeof PROMOTION_DECISIONS)[number];

  @ApiPropertyOptional({
    description:
      'The section to place the student into (required for a manual decision)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  proposedClassSectionId?: string;

  @ApiPropertyOptional({ description: 'Why this student is an exception' })
  @IsOptional()
  @IsString()
  @MaxLength(240)
  reason?: string;
}

export class ReviewPromotionDto {
  @ApiPropertyOptional({
    description: 'Reason recorded on the approval/commit',
  })
  @IsOptional()
  @IsString()
  @MaxLength(240)
  reason?: string;
}
