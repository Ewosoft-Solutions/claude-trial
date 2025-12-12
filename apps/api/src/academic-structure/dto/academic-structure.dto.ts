import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../common/dto';

export const ACADEMIC_YEAR_STATUSES = [
  'planned',
  'active',
  'completed',
  'archived',
] as const;

export const TERM_STATUSES = ['planned', 'active', 'completed', 'archived'] as const;
export const TERM_TYPES = ['semester', 'trimester', 'quarter', 'term', 'custom'] as const;

export const COURSE_STATUSES = ['active', 'archived', 'draft'] as const;
export const CLASS_STATUSES = ['active', 'full', 'cancelled', 'archived'] as const;

export class CreateAcademicYearDto {
  @ApiProperty({ description: 'Name of the academic year (e.g., 2024-2025)' })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiProperty({ description: 'Start date' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ description: 'End date' })
  @IsDateString()
  endDate: string;

  @ApiPropertyOptional({
    description: 'Status',
    enum: ACADEMIC_YEAR_STATUSES,
    default: 'planned',
  })
  @IsOptional()
  @IsIn(ACADEMIC_YEAR_STATUSES)
  status?: (typeof ACADEMIC_YEAR_STATUSES)[number] = 'planned';

  @ApiPropertyOptional({ description: 'Mark as default/current year' })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({ description: 'Description' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class UpdateAcademicYearDto {
  @ApiPropertyOptional({ description: 'Name of the academic year' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ description: 'Start date' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Status', enum: ACADEMIC_YEAR_STATUSES })
  @IsOptional()
  @IsIn(ACADEMIC_YEAR_STATUSES)
  status?: (typeof ACADEMIC_YEAR_STATUSES)[number];

  @ApiPropertyOptional({ description: 'Mark as default/current year' })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({ description: 'Description' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class CreateTermDto {
  @ApiProperty({ description: 'Name of the term (e.g., Fall Term)' })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiProperty({ description: 'Term type', enum: TERM_TYPES })
  @IsString()
  @IsIn(TERM_TYPES)
  type: (typeof TERM_TYPES)[number];

  @ApiProperty({ description: 'Start date' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ description: 'End date' })
  @IsDateString()
  endDate: string;

  @ApiProperty({ description: 'Order/sequence for display' })
  @IsInt()
  order: number;

  @ApiPropertyOptional({ description: 'Status', enum: TERM_STATUSES, default: 'planned' })
  @IsOptional()
  @IsIn(TERM_STATUSES)
  status?: (typeof TERM_STATUSES)[number] = 'planned';

  @ApiPropertyOptional({ description: 'Description' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class UpdateTermDto {
  @ApiPropertyOptional({ description: 'Name of the term' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ description: 'Term type', enum: TERM_TYPES })
  @IsOptional()
  @IsIn(TERM_TYPES)
  type?: (typeof TERM_TYPES)[number];

  @ApiPropertyOptional({ description: 'Start date' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Order/sequence for display' })
  @IsOptional()
  @IsInt()
  order?: number;

  @ApiPropertyOptional({ description: 'Status', enum: TERM_STATUSES })
  @IsOptional()
  @IsIn(TERM_STATUSES)
  status?: (typeof TERM_STATUSES)[number];

  @ApiPropertyOptional({ description: 'Description' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class CreateCourseDto {
  @ApiProperty({ description: 'Course code (unique per tenant)' })
  @IsString()
  @MaxLength(50)
  code: string;

  @ApiProperty({ description: 'Course name' })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ description: 'Description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Category (e.g., Mathematics)' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Subject area' })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiPropertyOptional({ description: 'Grade levels (array)' })
  @IsOptional()
  @IsArray()
  gradeLevels?: string[];

  @ApiPropertyOptional({ description: 'Credits' })
  @IsOptional()
  credits?: number;

  @ApiPropertyOptional({ description: 'Hours' })
  @IsOptional()
  hours?: number;

  @ApiPropertyOptional({ description: 'Prerequisites description' })
  @IsOptional()
  @IsString()
  prerequisites?: string;

  @ApiPropertyOptional({ description: 'Objectives' })
  @IsOptional()
  @IsString()
  objectives?: string;

  @ApiPropertyOptional({
    description: 'Status',
    enum: COURSE_STATUSES,
    default: 'active',
  })
  @IsOptional()
  @IsIn(COURSE_STATUSES)
  status?: (typeof COURSE_STATUSES)[number] = 'active';
}

export class UpdateCourseDto {
  @ApiPropertyOptional({ description: 'Course code' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string;

  @ApiPropertyOptional({ description: 'Course name' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ description: 'Description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Category' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Subject area' })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiPropertyOptional({ description: 'Grade levels' })
  @IsOptional()
  @IsArray()
  gradeLevels?: string[];

  @ApiPropertyOptional({ description: 'Credits' })
  @IsOptional()
  credits?: number;

  @ApiPropertyOptional({ description: 'Hours' })
  @IsOptional()
  hours?: number;

  @ApiPropertyOptional({ description: 'Prerequisites' })
  @IsOptional()
  @IsString()
  prerequisites?: string;

  @ApiPropertyOptional({ description: 'Objectives' })
  @IsOptional()
  @IsString()
  objectives?: string;

  @ApiPropertyOptional({ description: 'Status', enum: COURSE_STATUSES })
  @IsOptional()
  @IsIn(COURSE_STATUSES)
  status?: (typeof COURSE_STATUSES)[number];
}

export class CreateClassDto {
  @ApiProperty({ description: 'Course ID' })
  @IsString()
  courseId: string;

  @ApiProperty({ description: 'Term ID' })
  @IsString()
  termId: string;

  @ApiProperty({ description: 'Academic year ID' })
  @IsString()
  academicYearId: string;

  @ApiProperty({ description: 'Section identifier (e.g., A, B)' })
  @IsString()
  @MaxLength(50)
  section: string;

  @ApiPropertyOptional({ description: 'Optional class name' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ description: 'Capacity (max students)' })
  @IsOptional()
  @IsInt()
  capacity?: number;

  @ApiPropertyOptional({ description: 'Schedule JSON payload' })
  @IsOptional()
  schedule?: any;

  @ApiPropertyOptional({ description: 'Room/location' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  room?: string;

  @ApiPropertyOptional({
    description: 'Status',
    enum: CLASS_STATUSES,
    default: 'active',
  })
  @IsOptional()
  @IsIn(CLASS_STATUSES)
  status?: (typeof CLASS_STATUSES)[number] = 'active';

  @ApiPropertyOptional({ description: 'Description' })
  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateClassDto {
  @ApiPropertyOptional({ description: 'Section identifier' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  section?: string;

  @ApiPropertyOptional({ description: 'Class name' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ description: 'Capacity' })
  @IsOptional()
  @IsInt()
  capacity?: number;

  @ApiPropertyOptional({ description: 'Schedule JSON payload' })
  @IsOptional()
  schedule?: any;

  @ApiPropertyOptional({ description: 'Room/location' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  room?: string;

  @ApiPropertyOptional({ description: 'Status', enum: CLASS_STATUSES })
  @IsOptional()
  @IsIn(CLASS_STATUSES)
  status?: (typeof CLASS_STATUSES)[number];

  @ApiPropertyOptional({ description: 'Description' })
  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateScheduleDto {
  @ApiProperty({ description: 'Schedule JSON payload' })
  schedule: any;
}

export class AssignStudentToClassDto {
  @ApiProperty({ description: 'Student ID to assign' })
  @IsString()
  studentId: string;
}

export class ListClassesDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by courseId' })
  @IsOptional()
  @IsString()
  courseId?: string;

  @ApiPropertyOptional({ description: 'Filter by termId' })
  @IsOptional()
  @IsString()
  termId?: string;

  @ApiPropertyOptional({ description: 'Filter by academicYearId' })
  @IsOptional()
  @IsString()
  academicYearId?: string;

  @ApiPropertyOptional({ description: 'Filter by status', enum: CLASS_STATUSES })
  @IsOptional()
  @IsIn(CLASS_STATUSES)
  status?: (typeof CLASS_STATUSES)[number];
}

