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

/**
 * The person-types the WB1-1 People directory presents as tabs. Student /
 * guardian / staff / user project over the F1 `Person` (so one identity shows
 * all its profiles); `prospect` projects over `AdmissionApplication` (a
 * prospect becomes a Person only on admission).
 */
export const PEOPLE_TYPES = [
  'all',
  'student',
  'guardian',
  'staff',
  'user',
  'prospect',
] as const;
export type PeopleType = (typeof PEOPLE_TYPES)[number];

/** Columns the People directory can sort by, server-side (per-type mapped). */
export const PEOPLE_DIRECTORY_SORT_FIELDS = ['name', 'createdAt'] as const;
export type PeopleDirectorySortField =
  (typeof PEOPLE_DIRECTORY_SORT_FIELDS)[number];

/**
 * Resources that can own a SavedView. `students` is the F7 list; the People
 * workbench scopes its views per tab (`people-<type>`) so a Staff-tab view
 * never leaks onto the Students tab.
 */
export const DIRECTORY_RESOURCES = [
  'students',
  'people-all',
  'people-student',
  'people-guardian',
  'people-staff',
  'people-user',
  'people-prospect',
] as const;

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

export class PeopleDirectoryQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    enum: PEOPLE_TYPES,
    default: 'student',
    description: 'Which person-type tab to project (defaults to student).',
  })
  @IsOptional()
  @IsIn(PEOPLE_TYPES as unknown as string[])
  type?: PeopleType;

  @ApiPropertyOptional({ description: 'Free-text search (name / number)' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @ApiPropertyOptional({
    enum: ['all', 'name'],
    default: 'all',
    description:
      "Search scope for `q`: 'all' (names + identifier + contact index for callers who may view contact) or 'name' (first/last/preferred name ONLY — for a name picker where matching a hidden email would be confusing).",
  })
  @IsOptional()
  @IsIn(['all', 'name'])
  match?: 'all' | 'name';

  @ApiPropertyOptional({ enum: PEOPLE_DIRECTORY_SORT_FIELDS })
  @IsOptional()
  @IsIn(PEOPLE_DIRECTORY_SORT_FIELDS as unknown as string[])
  sort?: PeopleDirectorySortField;

  @ApiPropertyOptional({ enum: SORT_DIRECTIONS, default: 'asc' })
  @IsOptional()
  @IsIn(SORT_DIRECTIONS as unknown as string[])
  dir?: 'asc' | 'desc';

  @ApiPropertyOptional({
    description:
      'Filter by the tab-appropriate status (enrollment / employment / account / decision; on the guardian tab: priority = primary|secondary).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  status?: string;

  @ApiPropertyOptional({
    description: 'All-people tab: filter to people holding this profile.',
    enum: ['student', 'guardian', 'staff', 'user'],
  })
  @IsOptional()
  @IsIn(['student', 'guardian', 'staff', 'user'])
  role?: 'student' | 'guardian' | 'staff' | 'user';

  @ApiPropertyOptional({ description: 'Student tab: filter by grade level.' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  grade?: string;

  @ApiPropertyOptional({ description: 'Staff tab: filter by department.' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  department?: string;

  @ApiPropertyOptional({
    description: 'Filter by whether the person has any contact point on file.',
    enum: ['true', 'false'],
  })
  @IsOptional()
  @IsIn(['true', 'false'])
  hasContact?: 'true' | 'false';
}

export class BulkExportPeopleDto {
  @ApiProperty({ enum: PEOPLE_TYPES })
  @IsIn(PEOPLE_TYPES as unknown as string[])
  type: PeopleType;

  @ApiProperty({
    description: 'Row ids to export (the selected rows of the active tab).',
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
