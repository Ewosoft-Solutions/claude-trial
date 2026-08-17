/**
 * DTOs for the WB2-1 ADR-02 structured academic model (Stage · YearLevel ·
 * Stream · ClassSection · SubjectOffering). The structure is stored as
 * dimensions; `displayLabel` is COMPOSED server-side from the dimensions, never
 * accepted from or parsed out of a free-text class name — so there is no
 * client-supplied label field on the create/update DTOs.
 *
 * The global ValidationPipe runs whitelist + forbidNonWhitelisted, so every
 * accepted property carries a class-validator decorator.
 */
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EDUCATION_LEVELS, LEVEL_CODES } from '@workspace/database';

export const STRUCTURE_STATUSES = ['active', 'inactive'] as const;
export const SECTION_STATUSES = ['active', 'archived'] as const;
export const OFFERING_STATUSES = ['active', 'archived'] as const;

// ---- Stage --------------------------------------------------------------

export class CreateStageDto {
  @ApiPropertyOptional({
    enum: EDUCATION_LEVELS,
    description:
      'The fixed band this stage belongs to. Optional only for legacy rows; ' +
      'set it on anything new so cross-school reporting can line stages up.',
  })
  @IsOptional()
  @IsIn(EDUCATION_LEVELS as unknown as string[])
  educationLevel?: string;

  @ApiProperty({ example: 'Senior Secondary' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string;

  @ApiProperty({ description: 'Short code, unique per tenant', example: 'SSS' })
  @IsString()
  @MinLength(1)
  @MaxLength(24)
  code: string;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}

export class UpdateStageDto {
  @ApiPropertyOptional({ example: 'Senior Secondary' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  @ApiPropertyOptional({ enum: STRUCTURE_STATUSES })
  @IsOptional()
  @IsIn(STRUCTURE_STATUSES)
  status?: (typeof STRUCTURE_STATUSES)[number];
}

// ---- YearLevel ----------------------------------------------------------

export class CreateYearLevelDto {
  @ApiPropertyOptional({
    enum: LEVEL_CODES,
    description:
      'The fixed national rung this level maps to (PRY_3, JSS_1, L_200…). ' +
      '`name` stays whatever the school calls it — "Basic 3", "Year 3".',
  })
  @IsOptional()
  @IsIn(LEVEL_CODES as unknown as string[])
  levelCode?: string;

  @ApiProperty({ description: 'The stage this year sits in' })
  @IsString()
  @MaxLength(64)
  stageId: string;

  @ApiProperty({ example: 'SS1' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string;

  @ApiProperty({ description: 'Short code, unique per tenant', example: 'SS1' })
  @IsString()
  @MinLength(1)
  @MaxLength(24)
  code: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}

export class UpdateYearLevelDto {
  @ApiPropertyOptional({ example: 'SS1' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  @ApiPropertyOptional({ enum: STRUCTURE_STATUSES })
  @IsOptional()
  @IsIn(STRUCTURE_STATUSES)
  status?: (typeof STRUCTURE_STATUSES)[number];
}

// ---- Stream -------------------------------------------------------------

export class CreateStreamDto {
  @ApiPropertyOptional({
    description: 'What this arm means here, in the school’s own words',
  })
  @IsOptional()
  @IsString()
  @MaxLength(280)
  description?: string;

  @ApiPropertyOptional({
    description: 'Other names this arm answers to (search + import matching)',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  aliases?: string[];

  @ApiProperty({ example: 'Science' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string;

  @ApiProperty({ description: 'Short code, unique per tenant', example: 'SCI' })
  @IsString()
  @MinLength(1)
  @MaxLength(24)
  code: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}

export class UpdateStreamDto {
  @ApiPropertyOptional({ example: 'Science' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  @ApiPropertyOptional({ enum: STRUCTURE_STATUSES })
  @IsOptional()
  @IsIn(STRUCTURE_STATUSES)
  status?: (typeof STRUCTURE_STATUSES)[number];
}

// ---- ClassSection -------------------------------------------------------

export class CreateClassSectionDto {
  @ApiProperty({
    description: 'The campus this section belongs to (WB1-6 scope target)',
  })
  @IsString()
  @MaxLength(64)
  campusId: string;

  @ApiProperty({ description: 'The year level' })
  @IsString()
  @MaxLength(64)
  yearLevelId: string;

  @ApiPropertyOptional({
    description: 'The stream/pathway (SS1 SCIENCE vs SS1 ARTS)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  streamId?: string;

  @ApiProperty({ description: 'The arm/section name', example: 'A' })
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name: string;

  @ApiPropertyOptional({ example: 40, default: 30 })
  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;
}

export class UpdateClassSectionDto {
  @ApiPropertyOptional({ description: 'The stream/pathway' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  streamId?: string;

  @ApiPropertyOptional({ example: 'A' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name?: string;

  @ApiPropertyOptional({ example: 40 })
  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;

  @ApiPropertyOptional({ enum: SECTION_STATUSES })
  @IsOptional()
  @IsIn(SECTION_STATUSES)
  status?: (typeof SECTION_STATUSES)[number];
}

// ---- SubjectOffering ----------------------------------------------------

export class CreateSubjectOfferingDto {
  @ApiProperty({ description: 'The class section the subject is offered to' })
  @IsString()
  @MaxLength(64)
  classSectionId: string;

  @ApiProperty({ description: 'The academic year' })
  @IsString()
  @MaxLength(64)
  academicYearId: string;

  @ApiPropertyOptional({ description: 'The term (null = year-long)' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  termId?: string;

  @ApiProperty({ description: 'The F6 curriculum subject offered' })
  @IsString()
  @MaxLength(64)
  curriculumSubjectId: string;

  @ApiPropertyOptional({
    description: 'Whether this offering is an elective',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isElective?: boolean;
}

export class UpdateSubjectOfferingDto {
  @ApiPropertyOptional({ description: 'Whether this offering is an elective' })
  @IsOptional()
  @IsBoolean()
  isElective?: boolean;

  @ApiPropertyOptional({ enum: OFFERING_STATUSES })
  @IsOptional()
  @IsIn(OFFERING_STATUSES)
  status?: (typeof OFFERING_STATUSES)[number];
}

// ---- List filters -------------------------------------------------------

export class ListYearLevelsDto {
  @ApiPropertyOptional({ description: 'Filter by stage' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  stageId?: string;
}

export class ListClassSectionsDto {
  @ApiPropertyOptional({ description: 'Filter by campus' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  campusId?: string;

  @ApiPropertyOptional({ description: 'Filter by year level' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  yearLevelId?: string;

  @ApiPropertyOptional({ description: 'Filter by stream' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  streamId?: string;
}

export class ListSubjectOfferingsDto {
  @ApiPropertyOptional({ description: 'Filter by class section' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  classSectionId?: string;

  @ApiPropertyOptional({ description: 'Filter by academic year' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  academicYearId?: string;
}
