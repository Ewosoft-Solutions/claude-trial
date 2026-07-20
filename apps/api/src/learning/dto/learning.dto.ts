import {
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

export const LESSON_STATUSES = ['draft', 'published', 'archived'] as const;
export type LessonStatus = (typeof LESSON_STATUSES)[number];

export const REVIEW_STATUSES = [
  'draft',
  'pending_review',
  'approved',
  'rejected',
] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

const MAX_CONTENT_LENGTH = 100_000; // Rich-text lesson note body

export class CreateLessonDto {
  @ApiProperty({ example: 'a1b2c3d4-0000-0000-0000-000000000000' })
  @IsString() @IsNotEmpty() classId!: string;

  @ApiProperty({ example: 'Photosynthesis' })
  @IsString() @IsNotEmpty() @MaxLength(200) title!: string;

  @ApiPropertyOptional({ example: 'How plants convert light into energy' })
  @IsOptional() @IsString() @MaxLength(2000) description?: string;

  @ApiPropertyOptional({ description: 'Lesson note body (rich text)' })
  @IsOptional() @IsString() @MaxLength(MAX_CONTENT_LENGTH) content?: string;

  @ApiPropertyOptional({ example: 1, description: 'Display order within the class' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) order?: number;

  @ApiPropertyOptional({ enum: LESSON_STATUSES, example: 'draft' })
  @IsOptional() @IsIn(LESSON_STATUSES) status?: LessonStatus;
}

export class UpdateLessonDto {
  @ApiPropertyOptional({ example: 'Photosynthesis' })
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(200) title?: string;

  @ApiPropertyOptional({ example: 'How plants convert light into energy' })
  @IsOptional() @IsString() @MaxLength(2000) description?: string;

  @ApiPropertyOptional({ description: 'Lesson note body (rich text)' })
  @IsOptional() @IsString() @MaxLength(MAX_CONTENT_LENGTH) content?: string;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) order?: number;

  @ApiPropertyOptional({ enum: LESSON_STATUSES, example: 'published' })
  @IsOptional() @IsIn(LESSON_STATUSES) status?: LessonStatus;
}

export class ListLessonsDto {
  @ApiPropertyOptional({ example: 'a1b2c3d4-0000-0000-0000-000000000000' })
  @IsOptional() @IsString() classId?: string;

  @ApiPropertyOptional({ enum: LESSON_STATUSES, example: 'published' })
  @IsOptional() @IsIn(LESSON_STATUSES) status?: LessonStatus;

  @ApiPropertyOptional({ enum: REVIEW_STATUSES, example: 'pending_review' })
  @IsOptional() @IsIn(REVIEW_STATUSES) reviewStatus?: ReviewStatus;
}

export class ReviewDecisionDto {
  @ApiPropertyOptional({
    example: 'Please add the summary section before publishing',
    description: 'Reviewer note (required when rejecting)',
  })
  @IsOptional() @IsString() @MaxLength(2000) note?: string;
}

export class UploadMaterialDto {
  @ApiPropertyOptional({
    example: 'Chapter 3 — Photosynthesis notes',
    description: 'Display title; defaults to the uploaded file name',
  })
  @IsOptional() @IsString() @MaxLength(200) title?: string;
}

export class SearchChunksDto {
  @ApiProperty({ example: 'How does the Calvin cycle work?' })
  @IsString() @IsNotEmpty() @MaxLength(2000) query!: string;

  @ApiPropertyOptional({ example: 5, description: 'Chunks to return (1-20, default 5)' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(20) topK?: number;
}
