/**
 * Alignment step 2 · DTOs for the lesson library (chapters) and the per-class
 * instances that point at it.
 */
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateLessonChapterDto {
  @ApiProperty({ description: 'The F6 curriculum subject this chapter groups' })
  @IsString()
  @MaxLength(64)
  curriculumSubjectId!: string;

  @ApiProperty({ example: 'Chapter 3 — Fractions' })
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ description: 'Stored object key for the tile image' })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  thumbnailKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}

export class UpdateLessonChapterDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(512)
  thumbnailKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  @ApiPropertyOptional({ enum: ['active', 'archived'] })
  @IsOptional()
  @IsIn(['active', 'archived'])
  status?: string;
}

export class CreateLessonInstanceDto {
  @ApiProperty({ description: 'The library lesson being scheduled' })
  @IsString()
  @MaxLength(64)
  lessonId!: string;

  @ApiProperty({ description: 'The offering (section × subject × year/term)' })
  @IsString()
  @MaxLength(64)
  subjectOfferingId!: string;

  @ApiPropertyOptional({
    description: 'Per-class title; omit to use the library lesson’s own',
  })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  titleOverride?: string;

  @ApiPropertyOptional({ description: 'This arm’s own notes' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;

  @ApiPropertyOptional({ example: '2026-09-14T09:00:00.000Z' })
  @IsOptional()
  @IsISO8601()
  scheduledFor?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}

export class UpdateLessonInstanceDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  titleOverride?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  scheduledFor?: string;

  @ApiPropertyOptional({
    enum: ['planned', 'taught', 'skipped'],
    description: 'Marking it taught stamps taughtAt automatically',
  })
  @IsOptional()
  @IsIn(['planned', 'taught', 'skipped'])
  status?: 'planned' | 'taught' | 'skipped';

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}
