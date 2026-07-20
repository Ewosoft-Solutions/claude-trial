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
  @ApiProperty({ description: 'Name of the academic year (e.g., 2024-2025)', example: '2024-2025' })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiProperty({ description: 'Start date', example: '2024-09-09' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ description: 'End date', example: '2025-07-18' })
  @IsDateString()
  endDate: string;

  @ApiPropertyOptional({
    description: 'Status',
    enum: ACADEMIC_YEAR_STATUSES,
    example: 'planned',
    default: 'planned',
  })
  @IsOptional()
  @IsIn(ACADEMIC_YEAR_STATUSES)
  status?: (typeof ACADEMIC_YEAR_STATUSES)[number] = 'planned';

  @ApiPropertyOptional({ description: 'Mark as default/current year', example: true })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({ description: 'Description', example: 'Standard academic calendar for all campuses' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class UpdateAcademicYearDto {
  @ApiPropertyOptional({ description: 'Name of the academic year', example: '2024-2025' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ description: 'Start date', example: '2024-09-09' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date', example: '2025-07-18' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Status', enum: ACADEMIC_YEAR_STATUSES, example: 'active' })
  @IsOptional()
  @IsIn(ACADEMIC_YEAR_STATUSES)
  status?: (typeof ACADEMIC_YEAR_STATUSES)[number];

  @ApiPropertyOptional({ description: 'Mark as default/current year', example: true })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({ description: 'Description', example: 'Standard academic calendar for all campuses' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class CreateTermDto {
  @ApiProperty({ description: 'Name of the term (e.g., Fall Term)', example: 'First Term' })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiProperty({ description: 'Term type', enum: TERM_TYPES, example: 'term' })
  @IsString()
  @IsIn(TERM_TYPES)
  type: (typeof TERM_TYPES)[number];

  @ApiProperty({ description: 'Start date', example: '2024-09-09' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ description: 'End date', example: '2024-12-13' })
  @IsDateString()
  endDate: string;

  @ApiProperty({ description: 'Order/sequence for display', example: 1 })
  @IsInt()
  order: number;

  @ApiPropertyOptional({ description: 'Status', enum: TERM_STATUSES, example: 'planned', default: 'planned' })
  @IsOptional()
  @IsIn(TERM_STATUSES)
  status?: (typeof TERM_STATUSES)[number] = 'planned';

  @ApiPropertyOptional({ description: 'Description', example: 'First term of the 2024-2025 academic year' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class UpdateTermDto {
  @ApiPropertyOptional({ description: 'Name of the term', example: 'First Term' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ description: 'Term type', enum: TERM_TYPES, example: 'term' })
  @IsOptional()
  @IsIn(TERM_TYPES)
  type?: (typeof TERM_TYPES)[number];

  @ApiPropertyOptional({ description: 'Start date', example: '2024-09-09' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date', example: '2024-12-13' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Order/sequence for display', example: 1 })
  @IsOptional()
  @IsInt()
  order?: number;

  @ApiPropertyOptional({ description: 'Status', enum: TERM_STATUSES, example: 'active' })
  @IsOptional()
  @IsIn(TERM_STATUSES)
  status?: (typeof TERM_STATUSES)[number];

  @ApiPropertyOptional({ description: 'Description', example: 'First term of the 2024-2025 academic year' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class CreateCourseDto {
  @ApiProperty({ description: 'Course code (unique per tenant)', example: 'MTH-101' })
  @IsString()
  @MaxLength(50)
  code: string;

  @ApiProperty({ description: 'Course name', example: 'Mathematics' })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ description: 'Description', example: 'Core mathematics curriculum covering algebra and geometry' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Category (e.g., Mathematics)', example: 'Sciences' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Subject area', example: 'Mathematics' })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiPropertyOptional({ description: 'Grade levels (array)', example: ['JSS 1', 'JSS 2'] })
  @IsOptional()
  @IsArray()
  gradeLevels?: string[];

  @ApiPropertyOptional({ description: 'Credits', example: 3 })
  @IsOptional()
  credits?: number;

  @ApiPropertyOptional({ description: 'Hours', example: 120 })
  @IsOptional()
  hours?: number;

  @ApiPropertyOptional({ description: 'Prerequisites description', example: 'None' })
  @IsOptional()
  @IsString()
  prerequisites?: string;

  @ApiPropertyOptional({ description: 'Objectives', example: 'Build foundational algebra and geometry skills' })
  @IsOptional()
  @IsString()
  objectives?: string;

  @ApiPropertyOptional({
    description: 'Status',
    enum: COURSE_STATUSES,
    example: 'active',
    default: 'active',
  })
  @IsOptional()
  @IsIn(COURSE_STATUSES)
  status?: (typeof COURSE_STATUSES)[number] = 'active';
}

export class UpdateCourseDto {
  @ApiPropertyOptional({ description: 'Course code', example: 'MTH-101' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string;

  @ApiPropertyOptional({ description: 'Course name', example: 'Mathematics' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ description: 'Description', example: 'Core mathematics curriculum covering algebra and geometry' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Category', example: 'Sciences' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Subject area', example: 'Mathematics' })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiPropertyOptional({ description: 'Grade levels', example: ['JSS 1', 'JSS 2'] })
  @IsOptional()
  @IsArray()
  gradeLevels?: string[];

  @ApiPropertyOptional({ description: 'Credits', example: 3 })
  @IsOptional()
  credits?: number;

  @ApiPropertyOptional({ description: 'Hours', example: 120 })
  @IsOptional()
  hours?: number;

  @ApiPropertyOptional({ description: 'Prerequisites', example: 'None' })
  @IsOptional()
  @IsString()
  prerequisites?: string;

  @ApiPropertyOptional({ description: 'Objectives', example: 'Build foundational algebra and geometry skills' })
  @IsOptional()
  @IsString()
  objectives?: string;

  @ApiPropertyOptional({ description: 'Status', enum: COURSE_STATUSES, example: 'active' })
  @IsOptional()
  @IsIn(COURSE_STATUSES)
  status?: (typeof COURSE_STATUSES)[number];
}

export class CreateClassDto {
  @ApiProperty({ description: 'Course ID', example: 'a1b2c3d4-e5f6-4789-9abc-def012345678' })
  @IsString()
  courseId: string;

  @ApiProperty({ description: 'Term ID', example: 'b2c3d4e5-f6a7-4890-9abc-ef0123456789' })
  @IsString()
  termId: string;

  @ApiProperty({ description: 'Academic year ID', example: 'c3d4e5f6-a7b8-4901-9abc-f01234567890' })
  @IsString()
  academicYearId: string;

  @ApiProperty({ description: 'Section identifier (e.g., A, B)', example: 'A' })
  @IsString()
  @MaxLength(50)
  section: string;

  @ApiPropertyOptional({ description: 'Optional class name', example: 'JSS 1 Mathematics - Section A' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ description: 'Capacity (max students)', example: 40 })
  @IsOptional()
  @IsInt()
  capacity?: number;

  @ApiPropertyOptional({ description: 'Schedule JSON payload', example: { days: ['Mon', 'Wed', 'Fri'], startTime: '08:00', endTime: '09:00' } })
  @IsOptional()
  schedule?: any;

  @ApiPropertyOptional({ description: 'Room/location', example: 'Block B - Room 12' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  room?: string;

  @ApiPropertyOptional({
    description: 'Status',
    enum: CLASS_STATUSES,
    example: 'active',
    default: 'active',
  })
  @IsOptional()
  @IsIn(CLASS_STATUSES)
  status?: (typeof CLASS_STATUSES)[number] = 'active';

  @ApiPropertyOptional({ description: 'Description', example: 'JSS 1 Mathematics, morning session' })
  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateClassDto {
  @ApiPropertyOptional({ description: 'Section identifier', example: 'A' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  section?: string;

  @ApiPropertyOptional({ description: 'Class name', example: 'JSS 1 Mathematics - Section A' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ description: 'Capacity', example: 40 })
  @IsOptional()
  @IsInt()
  capacity?: number;

  @ApiPropertyOptional({ description: 'Schedule JSON payload', example: { days: ['Mon', 'Wed', 'Fri'], startTime: '08:00', endTime: '09:00' } })
  @IsOptional()
  schedule?: any;

  @ApiPropertyOptional({ description: 'Room/location', example: 'Block B - Room 12' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  room?: string;

  @ApiPropertyOptional({ description: 'Status', enum: CLASS_STATUSES, example: 'full' })
  @IsOptional()
  @IsIn(CLASS_STATUSES)
  status?: (typeof CLASS_STATUSES)[number];

  @ApiPropertyOptional({ description: 'Description', example: 'JSS 1 Mathematics, morning session' })
  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateScheduleDto {
  @ApiProperty({ description: 'Schedule JSON payload', example: { days: ['Mon', 'Wed', 'Fri'], startTime: '08:00', endTime: '09:00' } })
  schedule: any;
}

export class AssignStudentToClassDto {
  @ApiProperty({ description: 'Student ID to assign', example: 'a1b2c3d4-e5f6-4789-9abc-def012345678' })
  @IsString()
  studentId: string;
}

export const CLASS_TEACHER_ROLES = [
  'teacher',
  'assistant',
  'co-teacher',
  'substitute',
] as const;

export class AssignTeacherToClassDto {
  @ApiProperty({ description: "Teacher's profile (UserTenant) ID", example: 'a1b2c3d4-e5f6-4789-9abc-def012345678' })
  @IsString()
  userTenantId: string;

  @ApiPropertyOptional({ description: 'Assignment role', enum: CLASS_TEACHER_ROLES, example: 'teacher' })
  @IsOptional()
  @IsIn(CLASS_TEACHER_ROLES)
  role?: (typeof CLASS_TEACHER_ROLES)[number];
}

export class ListClassesDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by courseId', example: 'a1b2c3d4-e5f6-4789-9abc-def012345678' })
  @IsOptional()
  @IsString()
  courseId?: string;

  @ApiPropertyOptional({ description: 'Filter by termId', example: 'b2c3d4e5-f6a7-4890-9abc-ef0123456789' })
  @IsOptional()
  @IsString()
  termId?: string;

  @ApiPropertyOptional({ description: 'Filter by academicYearId', example: 'c3d4e5f6-a7b8-4901-9abc-f01234567890' })
  @IsOptional()
  @IsString()
  academicYearId?: string;

  @ApiPropertyOptional({ description: 'Filter by status', enum: CLASS_STATUSES, example: 'active' })
  @IsOptional()
  @IsIn(CLASS_STATUSES)
  status?: (typeof CLASS_STATUSES)[number];
}

