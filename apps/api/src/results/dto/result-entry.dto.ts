/**
 * WB4 · Result-entry DTOs — direct capture of component scores per (student ·
 * subject offering · component), with absent/exempt flags, plus an optional
 * seed-from-gradebook trigger.
 */
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ResultEntryInputDto {
  @ApiProperty()
  @IsString()
  @MaxLength(64)
  studentId: string;

  @ApiProperty()
  @IsString()
  @MaxLength(64)
  subjectOfferingId: string;

  @ApiProperty({ example: 'CA1' })
  @IsString()
  @MaxLength(24)
  componentKey: string;

  @ApiPropertyOptional({ description: 'Null when absent/exempt' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000)
  score?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isAbsent?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isExempt?: boolean;
}

export class UpsertResultEntriesDto {
  @ApiProperty({ type: [ResultEntryInputDto] })
  @IsArray()
  @ArrayMaxSize(2000)
  @ValidateNested({ each: true })
  @Type(() => ResultEntryInputDto)
  entries: ResultEntryInputDto[];
}

export class SeedFromGradebookDto {
  @ApiPropertyOptional({
    description:
      'Only seed these subject offerings (omit = every offering in scope)',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(500)
  subjectOfferingIds?: string[];

  @ApiPropertyOptional({
    description: 'Component key the aggregated gradebook percentage maps to',
    example: 'CA1',
  })
  @IsOptional()
  @IsString()
  @MaxLength(24)
  componentKey?: string;
}
