import {
  IsArray,
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  ArrayMaxSize,
  ArrayNotEmpty,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../common/dto';

/**
 * Columns the governed students directory can sort by, server-side. `fees` is
 * intentionally excluded — it is a per-page aggregate over FeeInvoice, so
 * sorting it in the DB would break pagination; the projection returns it for
 * display only.
 */
export const STUDENT_DIRECTORY_SORT_FIELDS = [
  'name',
  'studentNumber',
  'gradeLevel',
  'status',
  'createdAt',
] as const;
export type StudentDirectorySortField =
  (typeof STUDENT_DIRECTORY_SORT_FIELDS)[number];

export const SORT_DIRECTIONS = ['asc', 'desc'] as const;

/** Resources that can own a SavedView today (extended as lists adopt F7). */
export const DIRECTORY_RESOURCES = ['students'] as const;

export class StudentDirectoryQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Free-text search (name / number)' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @ApiPropertyOptional({ enum: STUDENT_DIRECTORY_SORT_FIELDS })
  @IsOptional()
  @IsIn(STUDENT_DIRECTORY_SORT_FIELDS as unknown as string[])
  sort?: StudentDirectorySortField;

  @ApiPropertyOptional({ enum: SORT_DIRECTIONS, default: 'asc' })
  @IsOptional()
  @IsIn(SORT_DIRECTIONS as unknown as string[])
  dir?: 'asc' | 'desc';

  @ApiPropertyOptional({ description: 'Filter by enrollment status' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  status?: string;

  @ApiPropertyOptional({ description: 'Filter by grade level' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  gradeLevel?: string;

  @ApiPropertyOptional({ description: 'Filter by active class enrollment' })
  @IsOptional()
  @IsUUID()
  classId?: string;
}

export class BulkExportStudentsDto {
  @ApiProperty({
    description: 'Student ids to export (the selected rows).',
    type: [String],
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(1000)
  @IsUUID('all', { each: true })
  ids: string[];
}

export class ListSavedViewsDto {
  @ApiProperty({ enum: DIRECTORY_RESOURCES })
  @IsIn(DIRECTORY_RESOURCES as unknown as string[])
  resource: string;
}

export class CreateSavedViewDto {
  @ApiProperty({ enum: DIRECTORY_RESOURCES })
  @IsIn(DIRECTORY_RESOURCES as unknown as string[])
  resource: string;

  @ApiProperty({ example: 'Owing — SS1' })
  @IsString()
  @MaxLength(120)
  name: string;

  @ApiProperty({
    description: 'Serialized directory state (q / filters / sort / pageSize).',
  })
  @IsObject()
  state: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Visible to the whole tenant.' })
  @IsOptional()
  @IsBoolean()
  isShared?: boolean;

  @ApiPropertyOptional({
    description: "The owner's default for this resource.",
  })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateSavedViewDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  state?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isShared?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
