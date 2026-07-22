import {
  IsArray,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { HEALTH_FLAG_CODES } from '@workspace/api';

/**
 * Coerce a query param to a string array. `?flags=a` arrives as a string and
 * `?flags=a&flags=b` as an array; normalize both so a single-flag search is not
 * rejected by `@IsArray()`.
 */
const toStringArray = ({ value }: { value: unknown }): unknown =>
  value === undefined || value === null
    ? value
    : Array.isArray(value)
      ? value
      : [value];

export const HEALTH_RECORD_STATUSES = ['normal', 'monitoring', 'urgent'] as const;
export type HealthRecordStatus = (typeof HEALTH_RECORD_STATUSES)[number];

export class UpsertHealthRecordDto {
  @ApiPropertyOptional({ example: 'O+' })
  @IsOptional() @IsString() bloodType?: string;

  @ApiPropertyOptional({ example: 'Penicillin, peanuts' })
  @IsOptional() @IsString() allergies?: string;

  @ApiPropertyOptional({ example: 'Mild asthma' })
  @IsOptional() @IsString() conditions?: string;

  @ApiPropertyOptional({ example: 'Ventolin inhaler as needed' })
  @IsOptional() @IsString() medications?: string;

  @ApiPropertyOptional({ example: 'Mrs. E. Achebe' })
  @IsOptional() @IsString() emergencyContactName?: string;

  @ApiPropertyOptional({ example: '+234-801-234-5678' })
  @IsOptional() @IsString() emergencyContactPhone?: string;

  @ApiPropertyOptional({ example: '2026-05-01' })
  @IsOptional() @IsDateString() lastCheckup?: string;

  @ApiPropertyOptional({ enum: HEALTH_RECORD_STATUSES, example: 'monitoring' })
  @IsOptional() @IsIn(HEALTH_RECORD_STATUSES) status?: HealthRecordStatus;

  @ApiPropertyOptional({ example: 'Carries inhaler at all times' })
  @IsOptional() @IsString() notes?: string;

  /**
   * Controlled-vocabulary codes. These are what flag search matches — the free
   * text above is never searched. Passing `[]` clears a pupil's flags; omitting
   * the field leaves them unchanged.
   */
  @ApiPropertyOptional({
    example: ['allergy:peanut', 'condition:asthma'],
    isArray: true,
    enum: HEALTH_FLAG_CODES,
    description:
      'Controlled-vocabulary health flags. Searchable; the free-text fields are not.',
  })
  @IsOptional() @IsArray() @IsString({ each: true }) healthFlags?: string[];
}

export class ListHealthRecordsDto {
  @ApiPropertyOptional({ enum: HEALTH_RECORD_STATUSES, example: 'monitoring' })
  @IsOptional() @IsIn(HEALTH_RECORD_STATUSES) status?: HealthRecordStatus;

  @ApiPropertyOptional({ example: 'Achebe', description: 'Free-text search across student name' })
  @IsOptional() @IsString() query?: string;

  @ApiPropertyOptional({
    example: ['allergy:peanut'],
    isArray: true,
    enum: HEALTH_FLAG_CODES,
    description: 'Filter by health flags, e.g. before a trip or catering order.',
  })
  @IsOptional()
  @Transform(toStringArray)
  @IsArray()
  @IsString({ each: true })
  flags?: string[];

  @ApiPropertyOptional({
    enum: ['any', 'all'],
    example: 'any',
    description:
      "Match pupils with ANY of the flags (default) or ALL of them. Default 'any' — the safe direction for a screening query, since a narrower default could hide a pupil.",
  })
  @IsOptional() @IsIn(['any', 'all']) flagsMatch?: 'any' | 'all';
}
