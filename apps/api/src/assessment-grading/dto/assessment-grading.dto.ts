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
  @ApiProperty({ description: 'Name of grading system', example: 'WAEC Grading Scale' })
  @IsString()
  @MaxLength(150)
  name: string;

  @ApiProperty({ description: 'Grading system type', enum: GRADING_SYSTEM_TYPES, example: 'letter_grade' })
  @IsString()
  @IsIn(GRADING_SYSTEM_TYPES)
  systemType: (typeof GRADING_SYSTEM_TYPES)[number];

  @ApiProperty({
    description: 'Grade scale JSON definition',
    example: [
      { grade: 'A1', minScore: 75, maxScore: 100 },
      { grade: 'B2', minScore: 70, maxScore: 74 },
      { grade: 'C4', minScore: 60, maxScore: 64 },
    ],
  })
  gradeScale: any;

  @ApiPropertyOptional({ description: 'Mark as default for tenant', example: true })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({ description: 'Is active', example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Description', example: 'Standard WAEC-aligned letter grading scale' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class UpdateGradingSystemDto {
  @ApiPropertyOptional({ description: 'Name of grading system', example: 'WAEC Grading Scale' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  name?: string;

  @ApiPropertyOptional({ description: 'Grading system type', enum: GRADING_SYSTEM_TYPES, example: 'letter_grade' })
  @IsOptional()
  @IsIn(GRADING_SYSTEM_TYPES)
  systemType?: (typeof GRADING_SYSTEM_TYPES)[number];

  @ApiPropertyOptional({
    description: 'Grade scale JSON definition',
    example: [
      { grade: 'A1', minScore: 75, maxScore: 100 },
      { grade: 'B2', minScore: 70, maxScore: 74 },
      { grade: 'C4', minScore: 60, maxScore: 64 },
    ],
  })
  @IsOptional()
  gradeScale?: any;

  @ApiPropertyOptional({ description: 'Mark as default for tenant', example: true })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({ description: 'Is active', example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Description', example: 'Standard WAEC-aligned letter grading scale' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class CreateAssessmentDto {
  @ApiProperty({ description: 'Class ID', example: 'a1b2c3d4-e5f6-4789-9abc-def012345678' })
  @IsString()
  classId: string;

  @ApiProperty({ description: 'Assessment name', example: 'First Term Mathematics Exam' })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiProperty({ description: 'Assessment type', enum: ASSESSMENT_TYPES, example: 'exam' })
  @IsString()
  @IsIn(ASSESSMENT_TYPES)
  type: (typeof ASSESSMENT_TYPES)[number];

  @ApiProperty({ description: 'Maximum points', example: 100 })
  @IsNumber()
  maxPoints: number;

  @ApiPropertyOptional({ description: 'Weight percentage (e.g., 25 for 25%)', example: 40 })
  @IsOptional()
  @IsNumber()
  weight?: number;

  @ApiPropertyOptional({ description: 'Grading system ID', example: 'd4e5f6a7-b8c9-4012-9abc-012345678901' })
  @IsOptional()
  @IsString()
  gradingSystemId?: string;

  @ApiPropertyOptional({ description: 'Assigned date', example: '2024-11-01' })
  @IsOptional()
  @IsDateString()
  assignedDate?: string;

  @ApiPropertyOptional({ description: 'Due date', example: '2024-12-06' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({ description: 'Instructions', example: 'Answer all questions in sections A and B' })
  @IsOptional()
  @IsString()
  instructions?: string;

  @ApiPropertyOptional({
    description: 'Rubric JSON',
    example: [{ criterion: 'Problem solving', maxPoints: 50 }, { criterion: 'Presentation', maxPoints: 50 }],
  })
  @IsOptional()
  rubric?: any;

  @ApiPropertyOptional({
    description: 'Status',
    enum: ASSESSMENT_STATUSES,
    example: 'published',
    default: 'draft',
  })
  @IsOptional()
  @IsIn(ASSESSMENT_STATUSES)
  status?: (typeof ASSESSMENT_STATUSES)[number] = 'draft';
}

export class UpdateAssessmentDto {
  @ApiPropertyOptional({ description: 'Assessment name', example: 'First Term Mathematics Exam' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ description: 'Assessment type', enum: ASSESSMENT_TYPES, example: 'exam' })
  @IsOptional()
  @IsIn(ASSESSMENT_TYPES)
  type?: (typeof ASSESSMENT_TYPES)[number];

  @ApiPropertyOptional({ description: 'Maximum points', example: 100 })
  @IsOptional()
  @IsNumber()
  maxPoints?: number;

  @ApiPropertyOptional({ description: 'Weight percentage', example: 40 })
  @IsOptional()
  @IsNumber()
  weight?: number;

  @ApiPropertyOptional({ description: 'Grading system ID', example: 'd4e5f6a7-b8c9-4012-9abc-012345678901' })
  @IsOptional()
  @IsString()
  gradingSystemId?: string;

  @ApiPropertyOptional({ description: 'Assigned date', example: '2024-11-01' })
  @IsOptional()
  @IsDateString()
  assignedDate?: string;

  @ApiPropertyOptional({ description: 'Due date', example: '2024-12-06' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({ description: 'Instructions', example: 'Answer all questions in sections A and B' })
  @IsOptional()
  @IsString()
  instructions?: string;

  @ApiPropertyOptional({
    description: 'Rubric JSON',
    example: [{ criterion: 'Problem solving', maxPoints: 50 }, { criterion: 'Presentation', maxPoints: 50 }],
  })
  @IsOptional()
  rubric?: any;

  @ApiPropertyOptional({ description: 'Status', enum: ASSESSMENT_STATUSES, example: 'graded' })
  @IsOptional()
  @IsIn(ASSESSMENT_STATUSES)
  status?: (typeof ASSESSMENT_STATUSES)[number];
}

export class CreateGradeDto {
  @ApiProperty({ description: 'Enrollment ID (student in class)', example: 'e5f6a7b8-c9d0-4123-9abc-123456789012' })
  @IsString()
  enrollmentId: string;

  @ApiProperty({ description: 'Assessment ID', example: 'f6a7b8c9-d0e1-4234-9abc-234567890123' })
  @IsString()
  assessmentId: string;

  @ApiPropertyOptional({ description: 'Points earned', example: 78 })
  @IsOptional()
  @IsNumber()
  pointsEarned?: number;

  @ApiPropertyOptional({ description: 'Percentage (computed if not provided)', example: 78 })
  @IsOptional()
  @IsNumber()
  percentage?: number;

  @ApiPropertyOptional({ description: 'Letter grade (computed if grading system provided)', example: 'B2' })
  @IsOptional()
  @IsString()
  letterGrade?: string;

  @ApiPropertyOptional({ description: 'GPA points (optional, may be computed)', example: 3.5 })
  @IsOptional()
  @IsNumber()
  gpaPoints?: number;

  @ApiPropertyOptional({ description: 'Status', enum: GRADE_STATUSES, example: 'graded', default: 'draft' })
  @IsOptional()
  @IsIn(GRADE_STATUSES)
  status?: (typeof GRADE_STATUSES)[number] = 'draft';

  @ApiPropertyOptional({ description: 'Submitted at', example: '2024-12-06T09:30:00.000Z' })
  @IsOptional()
  @IsDateString()
  submittedAt?: string;

  @ApiPropertyOptional({ description: 'Graded at', example: '2024-12-08T14:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  gradedAt?: string;

  @ApiPropertyOptional({ description: 'Feedback', example: 'Good understanding of core concepts, review word problems' })
  @IsOptional()
  @IsString()
  feedback?: string;

  @ApiPropertyOptional({
    description: 'Rubric score JSON',
    example: [{ criterion: 'Problem solving', score: 40 }, { criterion: 'Presentation', score: 38 }],
  })
  @IsOptional()
  rubricScore?: any;

  @ApiPropertyOptional({ description: 'Notes', example: 'Re-grade requested by parent, confirmed correct' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateGradeDto {
  @ApiPropertyOptional({ description: 'Points earned', example: 78 })
  @IsOptional()
  @IsNumber()
  pointsEarned?: number;

  @ApiPropertyOptional({ description: 'Percentage', example: 78 })
  @IsOptional()
  @IsNumber()
  percentage?: number;

  @ApiPropertyOptional({ description: 'Letter grade', example: 'B2' })
  @IsOptional()
  @IsString()
  letterGrade?: string;

  @ApiPropertyOptional({ description: 'GPA points', example: 3.5 })
  @IsOptional()
  @IsNumber()
  gpaPoints?: number;

  @ApiPropertyOptional({ description: 'Status', enum: GRADE_STATUSES, example: 'graded' })
  @IsOptional()
  @IsIn(GRADE_STATUSES)
  status?: (typeof GRADE_STATUSES)[number];

  @ApiPropertyOptional({ description: 'Submitted at', example: '2024-12-06T09:30:00.000Z' })
  @IsOptional()
  @IsDateString()
  submittedAt?: string;

  @ApiPropertyOptional({ description: 'Graded at', example: '2024-12-08T14:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  gradedAt?: string;

  @ApiPropertyOptional({ description: 'Feedback', example: 'Good understanding of core concepts, review word problems' })
  @IsOptional()
  @IsString()
  feedback?: string;

  @ApiPropertyOptional({
    description: 'Rubric score JSON',
    example: [{ criterion: 'Problem solving', score: 40 }, { criterion: 'Presentation', score: 38 }],
  })
  @IsOptional()
  rubricScore?: any;

  @ApiPropertyOptional({ description: 'Notes', example: 'Re-grade requested by parent, confirmed correct' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class ListAssessmentsDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by classId', example: 'a1b2c3d4-e5f6-4789-9abc-def012345678' })
  @IsOptional()
  @IsString()
  classId?: string;

  @ApiPropertyOptional({ description: 'Filter by status', enum: ASSESSMENT_STATUSES, example: 'published' })
  @IsOptional()
  @IsIn(ASSESSMENT_STATUSES)
  status?: (typeof ASSESSMENT_STATUSES)[number];

  @ApiPropertyOptional({ description: 'Filter by type', enum: ASSESSMENT_TYPES, example: 'exam' })
  @IsOptional()
  @IsIn(ASSESSMENT_TYPES)
  type?: (typeof ASSESSMENT_TYPES)[number];
}

