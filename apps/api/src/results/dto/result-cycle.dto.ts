/**
 * WB4 · Result-cycle configuration DTOs — create/update a cycle, configure its
 * scored components (CA/EXAM), pick the class sections in scope, and author
 * structured remark rule sets. class-validator decorators satisfy the global
 * whitelist + forbidNonWhitelisted pipe.
 */
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateResultCycleDto {
  @ApiProperty({ example: 'First Term Results 2026/27' })
  @IsString()
  @MaxLength(160)
  name: string;

  @ApiProperty({ description: 'Academic year the cycle covers' })
  @IsString()
  @MaxLength(64)
  academicYearId: string;

  @ApiPropertyOptional({ description: 'Term (omit = year-long)' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  termId?: string;

  @ApiPropertyOptional({ description: 'Optional year-level filter' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  yearLevelId?: string;

  @ApiPropertyOptional({
    description: 'Scope to a campus (omit = whole school)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  campusId?: string;
}

export class PromotionPolicyDto {
  @ApiProperty({ example: 40 })
  @IsNumber()
  @Min(0)
  @Max(100)
  passMark: number;

  @ApiProperty({ example: 3 })
  @IsInt()
  @Min(0)
  @Max(50)
  maxFailedSubjects: number;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(50)
  coreSubjectOfferingIds?: string[];
}

export class UpdateResultCycleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;

  @ApiPropertyOptional({ description: 'Grade scale (GradingSystem) id' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  gradingSystemId?: string;

  @ApiPropertyOptional({ description: 'Subject-level remark rule set id' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  subjectRemarkRuleSetId?: string;

  @ApiPropertyOptional({ description: 'Principal/overall remark rule set id' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  principalRemarkRuleSetId?: string;

  @ApiPropertyOptional({
    description: 'Enable ranking/positions (default off)',
  })
  @IsOptional()
  @IsBoolean()
  rankingEnabled?: boolean;

  @ApiPropertyOptional({
    description:
      'Promotion policy: { passMark, maxFailedSubjects, coreSubjectOfferingIds? }',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => PromotionPolicyDto)
  promotionPolicy?: PromotionPolicyDto;
}

export class ComponentDto {
  @ApiProperty({ example: 'CA1' })
  @IsString()
  @MaxLength(24)
  key: string;

  @ApiProperty({ example: 'First CA' })
  @IsString()
  @MaxLength(64)
  label: string;

  @ApiProperty({ example: 20 })
  @IsNumber()
  @Min(0)
  @Max(1000)
  maxScore: number;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000)
  weight?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isExam?: boolean;
}

export class ConfigureComponentsDto {
  @ApiProperty({ type: [ComponentDto] })
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ComponentDto)
  components: ComponentDto[];
}

export class SetCycleSectionsDto {
  @ApiProperty({ type: [String], description: 'Class section ids in scope' })
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(500)
  classSectionIds: string[];
}

export class RemarkRuleDto {
  @ApiProperty({ example: 75 })
  @IsNumber()
  @Min(0)
  @Max(100)
  minPercentage: number;

  @ApiProperty({ example: 100 })
  @IsNumber()
  @Min(0)
  @Max(100)
  maxPercentage: number;

  @ApiProperty({ example: 'Excellent — keep it up.' })
  @IsString()
  @MaxLength(500)
  comment: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}

export class CreateRemarkRuleSetDto {
  @ApiProperty({ example: 'Standard subject remarks' })
  @IsString()
  @MaxLength(160)
  name: string;

  @ApiProperty({ enum: ['subject', 'principal'] })
  @IsIn(['subject', 'principal'])
  kind: 'subject' | 'principal';

  @ApiProperty({ type: [RemarkRuleDto] })
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => RemarkRuleDto)
  rules: RemarkRuleDto[];
}
