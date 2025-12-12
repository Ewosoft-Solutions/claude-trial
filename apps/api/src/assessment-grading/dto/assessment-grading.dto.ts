import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../common/dto';

export const GRADING_SYSTEM_TYPES = [
  'percentage',
  'letter_grade',
  'gpa',
  'pass_fail',
  'custom',
] as const;

export const ASSESSMENT_TYPES = [
  'quiz',
  'test',
  'exam',
  'project',
  'homework',
  'assignment',
  'lab',
  'presentation',
  'participation',
  'custom',
] as const;

export const ASSESSMENT_STATUSES = [
  'draft',
  'published',
  'in_progress',
  'graded',
  'archived',
] as const;

export const GRADE_STATUSES = [
  'draft',
  'submitted',
  'graded',
  'late',
  'excused',
  'missing',
] as const;

export class CreateGradingSystemDto {
  @ApiProperty({ description: 'Name of grading system' })
  @IsString()
  @MaxLength(150)
  name: string;

  @ApiProperty({ description: 'Grading system type', enum: GRADING_SYSTEM_TYPES })
  @IsString()
  @IsIn(GRADING_SYSTEM_TYPES)
  systemType: (typeof GRADING_SYSTEM_TYPES)[number];

  @ApiProperty({ description: 'Grade scale JSON definition' })
  gradeScale: any;

  @ApiPropertyOptional({ description: 'Mark as default for tenant' })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({ description: 'Is active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Description' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class UpdateGradingSystemDto {
  @ApiPropertyOptional({ description: 'Name of grading system' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  name?: string;

  @ApiPropertyOptional({ description: 'Grading system type', enum: GRADING_SYSTEM_TYPES })
  @IsOptional()
  @IsIn(GRADING_SYSTEM_TYPES)
  systemType?: (typeof GRADING_SYSTEM_TYPES)[number];

  @ApiPropertyOptional({ description: 'Grade scale JSON definition' })
  @IsOptional()
  gradeScale?: any;

  @ApiPropertyOptional({ description: 'Mark as default for tenant' })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({ description: 'Is active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Description' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class CreateAssessmentDto {
  @ApiProperty({ description: 'Class ID' })
  @IsString()
  classId: string;

  @ApiProperty({ description: 'Assessment name' })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiProperty({ description: 'Assessment type', enum: ASSESSMENT_TYPES })
  @IsString()
  @IsIn(ASSESSMENT_TYPES)
  type: (typeof ASSESSMENT_TYPES)[number];

  @ApiProperty({ description: 'Maximum points' })
  @IsNumber()
  maxPoints: number;

  @ApiPropertyOptional({ description: 'Weight percentage (e.g., 25 for 25%)' })
  @IsOptional()
  @IsNumber()
  weight?: number;

  @ApiPropertyOptional({ description: 'Grading system ID' })
  @IsOptional()
  @IsString()
  gradingSystemId?: string;

  @ApiPropertyOptional({ description: 'Assigned date' })
  @IsOptional()
  @IsDateString()
  assignedDate?: string;

  @ApiPropertyOptional({ description: 'Due date' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({ description: 'Instructions' })
  @IsOptional()
  @IsString()
  instructions?: string;

  @ApiPropertyOptional({ description: 'Rubric JSON' })
  @IsOptional()
  rubric?: any;

  @ApiPropertyOptional({
    description: 'Status',
    enum: ASSESSMENT_STATUSES,
    default: 'draft',
  })
  @IsOptional()
  @IsIn(ASSESSMENT_STATUSES)
  status?: (typeof ASSESSMENT_STATUSES)[number] = 'draft';
}

export class UpdateAssessmentDto {
  @ApiPropertyOptional({ description: 'Assessment name' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ description: 'Assessment type', enum: ASSESSMENT_TYPES })
  @IsOptional()
  @IsIn(ASSESSMENT_TYPES)
  type?: (typeof ASSESSMENT_TYPES)[number];

  @ApiPropertyOptional({ description: 'Maximum points' })
  @IsOptional()
  @IsNumber()
  maxPoints?: number;

  @ApiPropertyOptional({ description: 'Weight percentage' })
  @IsOptional()
  @IsNumber()
  weight?: number;

  @ApiPropertyOptional({ description: 'Grading system ID' })
  @IsOptional()
  @IsString()
  gradingSystemId?: string;

  @ApiPropertyOptional({ description: 'Assigned date' })
  @IsOptional()
  @IsDateString()
  assignedDate?: string;

  @ApiPropertyOptional({ description: 'Due date' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({ description: 'Instructions' })
  @IsOptional()
  @IsString()
  instructions?: string;

  @ApiPropertyOptional({ description: 'Rubric JSON' })
  @IsOptional()
  rubric?: any;

  @ApiPropertyOptional({ description: 'Status', enum: ASSESSMENT_STATUSES })
  @IsOptional()
  @IsIn(ASSESSMENT_STATUSES)
  status?: (typeof ASSESSMENT_STATUSES)[number];
}

export class CreateGradeDto {
  @ApiProperty({ description: 'Enrollment ID (student in class)' })
  @IsString()
  enrollmentId: string;

  @ApiProperty({ description: 'Assessment ID' })
  @IsString()
  assessmentId: string;

  @ApiPropertyOptional({ description: 'Points earned' })
  @IsOptional()
  @IsNumber()
  pointsEarned?: number;

  @ApiPropertyOptional({ description: 'Percentage (computed if not provided)' })
  @IsOptional()
  @IsNumber()
  percentage?: number;

  @ApiPropertyOptional({ description: 'Letter grade (computed if grading system provided)' })
  @IsOptional()
  @IsString()
  letterGrade?: string;

  @ApiPropertyOptional({ description: 'GPA points (optional, may be computed)' })
  @IsOptional()
  @IsNumber()
  gpaPoints?: number;

  @ApiPropertyOptional({ description: 'Status', enum: GRADE_STATUSES, default: 'draft' })
  @IsOptional()
  @IsIn(GRADE_STATUSES)
  status?: (typeof GRADE_STATUSES)[number] = 'draft';

  @ApiPropertyOptional({ description: 'Submitted at' })
  @IsOptional()
  @IsDateString()
  submittedAt?: string;

  @ApiPropertyOptional({ description: 'Graded at' })
  @IsOptional()
  @IsDateString()
  gradedAt?: string;

  @ApiPropertyOptional({ description: 'Feedback' })
  @IsOptional()
  @IsString()
  feedback?: string;

  @ApiPropertyOptional({ description: 'Rubric score JSON' })
  @IsOptional()
  rubricScore?: any;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateGradeDto {
  @ApiPropertyOptional({ description: 'Points earned' })
  @IsOptional()
  @IsNumber()
  pointsEarned?: number;

  @ApiPropertyOptional({ description: 'Percentage' })
  @IsOptional()
  @IsNumber()
  percentage?: number;

  @ApiPropertyOptional({ description: 'Letter grade' })
  @IsOptional()
  @IsString()
  letterGrade?: string;

  @ApiPropertyOptional({ description: 'GPA points' })
  @IsOptional()
  @IsNumber()
  gpaPoints?: number;

  @ApiPropertyOptional({ description: 'Status', enum: GRADE_STATUSES })
  @IsOptional()
  @IsIn(GRADE_STATUSES)
  status?: (typeof GRADE_STATUSES)[number];

  @ApiPropertyOptional({ description: 'Submitted at' })
  @IsOptional()
  @IsDateString()
  submittedAt?: string;

  @ApiPropertyOptional({ description: 'Graded at' })
  @IsOptional()
  @IsDateString()
  gradedAt?: string;

  @ApiPropertyOptional({ description: 'Feedback' })
  @IsOptional()
  @IsString()
  feedback?: string;

  @ApiPropertyOptional({ description: 'Rubric score JSON' })
  @IsOptional()
  rubricScore?: any;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class ListAssessmentsDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by classId' })
  @IsOptional()
  @IsString()
  classId?: string;

  @ApiPropertyOptional({ description: 'Filter by status', enum: ASSESSMENT_STATUSES })
  @IsOptional()
  @IsIn(ASSESSMENT_STATUSES)
  status?: (typeof ASSESSMENT_STATUSES)[number];

  @ApiPropertyOptional({ description: 'Filter by type', enum: ASSESSMENT_TYPES })
  @IsOptional()
  @IsIn(ASSESSMENT_TYPES)
  type?: (typeof ASSESSMENT_TYPES)[number];
}

