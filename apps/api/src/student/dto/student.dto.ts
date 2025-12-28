import {
  IsString,
  IsOptional,
  IsIn,
  IsDateString,
  IsObject,
  IsArray,
  ValidateNested,
  IsNumber,
  IsUrl,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../common/dto';

export const STUDENT_ENROLLMENT_STATUSES = [
  'active',
  'inactive',
  'suspended',
  'graduated',
  'transferred',
  'withdrawn',
] as const;

export const ENROLLMENT_STATUSES = [
  'active',
  'dropped',
  'completed',
  'failed',
] as const;

class StudentDocumentDto {
  @ApiProperty({ description: 'Document name' })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiProperty({ description: 'Document URL' })
  @IsUrl()
  url: string;

  @ApiPropertyOptional({ description: 'Document type (e.g., pdf, image)' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  type?: string;

  @ApiPropertyOptional({ description: 'Optional description' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class CreateStudentDto {
  @ApiProperty({ description: 'Student number (unique per tenant)' })
  @IsString()
  studentNumber: string;

  @ApiProperty({ description: 'UserTenant profile ID for the student' })
  @IsString()
  userTenantId: string;

  @ApiPropertyOptional({ description: 'Admission number' })
  @IsOptional()
  @IsString()
  admissionNumber?: string;

  @ApiPropertyOptional({ description: 'Admission date' })
  @IsOptional()
  @IsDateString()
  admissionDate?: string;

  @ApiPropertyOptional({ description: 'Grade level (e.g., 9, 10, K)' })
  @IsOptional()
  @IsString()
  gradeLevel?: string;

  @ApiPropertyOptional({
    description: 'Enrollment status',
    enum: STUDENT_ENROLLMENT_STATUSES,
    default: 'active',
  })
  @IsOptional()
  @IsIn(STUDENT_ENROLLMENT_STATUSES)
  enrollmentStatus?: (typeof STUDENT_ENROLLMENT_STATUSES)[number] = 'active';

  @ApiPropertyOptional({ description: 'Enrollment date' })
  @IsOptional()
  @IsDateString()
  enrollmentDate?: string;

  @ApiPropertyOptional({ description: 'Graduation date' })
  @IsOptional()
  @IsDateString()
  graduationDate?: string;

  @ApiPropertyOptional({ description: 'Withdrawal date' })
  @IsOptional()
  @IsDateString()
  withdrawalDate?: string;

  @ApiPropertyOptional({ description: 'Transfer date' })
  @IsOptional()
  @IsDateString()
  transferDate?: string;

  @ApiPropertyOptional({ description: 'Personal information (JSON)' })
  @IsOptional()
  @IsObject()
  personalInfo?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Academic information (JSON)' })
  @IsOptional()
  @IsObject()
  academicInfo?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Health information (JSON)' })
  @IsOptional()
  @IsObject()
  healthInfo?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Emergency contacts (array)' })
  @IsOptional()
  @IsArray()
  emergencyContacts?: any[];

  @ApiPropertyOptional({ description: 'Special needs (array)' })
  @IsOptional()
  @IsArray()
  specialNeeds?: any[];
}

export class UpdateStudentDto {
  @ApiPropertyOptional({ description: 'Student number (unique per tenant)' })
  @IsOptional()
  @IsString()
  studentNumber?: string;

  @ApiPropertyOptional({ description: 'Admission number' })
  @IsOptional()
  @IsString()
  admissionNumber?: string;

  @ApiPropertyOptional({ description: 'Admission date' })
  @IsOptional()
  @IsDateString()
  admissionDate?: string;

  @ApiPropertyOptional({ description: 'Grade level (e.g., 9, 10, K)' })
  @IsOptional()
  @IsString()
  gradeLevel?: string;

  @ApiPropertyOptional({
    description: 'Enrollment status',
    enum: STUDENT_ENROLLMENT_STATUSES,
  })
  @IsOptional()
  @IsIn(STUDENT_ENROLLMENT_STATUSES)
  enrollmentStatus?: (typeof STUDENT_ENROLLMENT_STATUSES)[number];

  @ApiPropertyOptional({ description: 'Enrollment date' })
  @IsOptional()
  @IsDateString()
  enrollmentDate?: string;

  @ApiPropertyOptional({ description: 'Graduation date' })
  @IsOptional()
  @IsDateString()
  graduationDate?: string;

  @ApiPropertyOptional({ description: 'Withdrawal date' })
  @IsOptional()
  @IsDateString()
  withdrawalDate?: string;

  @ApiPropertyOptional({ description: 'Transfer date' })
  @IsOptional()
  @IsDateString()
  transferDate?: string;

  @ApiPropertyOptional({ description: 'Personal information (JSON)' })
  @IsOptional()
  @IsObject()
  personalInfo?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Academic information (JSON)' })
  @IsOptional()
  @IsObject()
  academicInfo?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Health information (JSON)' })
  @IsOptional()
  @IsObject()
  healthInfo?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Emergency contacts (array)' })
  @IsOptional()
  @IsArray()
  emergencyContacts?: any[];

  @ApiPropertyOptional({ description: 'Special needs (array)' })
  @IsOptional()
  @IsArray()
  specialNeeds?: any[];
}

export class UpdateStudentStatusDto {
  @ApiProperty({
    description: 'New enrollment status',
    enum: STUDENT_ENROLLMENT_STATUSES,
  })
  @IsString()
  @IsIn(STUDENT_ENROLLMENT_STATUSES)
  enrollmentStatus: (typeof STUDENT_ENROLLMENT_STATUSES)[number];

  @ApiPropertyOptional({ description: 'Graduation date' })
  @IsOptional()
  @IsDateString()
  graduationDate?: string;

  @ApiPropertyOptional({ description: 'Withdrawal date' })
  @IsOptional()
  @IsDateString()
  withdrawalDate?: string;

  @ApiPropertyOptional({ description: 'Transfer date' })
  @IsOptional()
  @IsDateString()
  transferDate?: string;

  @ApiPropertyOptional({ description: 'Enrollment date' })
  @IsOptional()
  @IsDateString()
  enrollmentDate?: string;
}

export class UpdateStudentProfileDto {
  @ApiPropertyOptional({ description: 'Personal information (JSON)' })
  @IsOptional()
  @IsObject()
  personalInfo?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Academic information (JSON)' })
  @IsOptional()
  @IsObject()
  academicInfo?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Health information (JSON)' })
  @IsOptional()
  @IsObject()
  healthInfo?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Emergency contacts (array)' })
  @IsOptional()
  @IsArray()
  emergencyContacts?: any[];

  @ApiPropertyOptional({ description: 'Special needs (array)' })
  @IsOptional()
  @IsArray()
  specialNeeds?: any[];

  @ApiPropertyOptional({ description: 'Student photo URL' })
  @IsOptional()
  @IsUrl()
  photoUrl?: string;

  @ApiPropertyOptional({
    description: 'Student documents metadata',
    type: [StudentDocumentDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StudentDocumentDto)
  documents?: StudentDocumentDto[];
}

export class SearchStudentsDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Search by name, email, or student number',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by enrollment status' })
  @IsOptional()
  @IsIn(STUDENT_ENROLLMENT_STATUSES)
  enrollmentStatus?: (typeof STUDENT_ENROLLMENT_STATUSES)[number];

  @ApiPropertyOptional({ description: 'Filter by grade level' })
  @IsOptional()
  @IsString()
  gradeLevel?: string;

  @ApiPropertyOptional({ description: 'Filter by student number' })
  @IsOptional()
  @IsString()
  studentNumber?: string;
}

export class EnrollStudentDto {
  @ApiProperty({ description: 'Class ID to enroll the student in' })
  @IsString()
  classId: string;

  @ApiProperty({ description: 'Academic year ID' })
  @IsString()
  academicYearId: string;

  @ApiProperty({ description: 'Term ID' })
  @IsString()
  termId: string;

  @ApiPropertyOptional({ description: 'Enrollment date' })
  @IsOptional()
  @IsDateString()
  enrollmentDate?: string;

  @ApiPropertyOptional({
    description: 'Enrollment status',
    enum: ENROLLMENT_STATUSES,
    default: 'active',
  })
  @IsOptional()
  @IsIn(ENROLLMENT_STATUSES)
  status?: (typeof ENROLLMENT_STATUSES)[number] = 'active';

  @ApiPropertyOptional({
    description: 'Final grade (for bulk import or updates)',
  })
  @IsOptional()
  @IsString()
  finalGrade?: string;

  @ApiPropertyOptional({ description: 'Credits earned' })
  @IsOptional()
  @IsNumber()
  creditsEarned?: number;

  @ApiPropertyOptional({ description: 'GPA points' })
  @IsOptional()
  @IsNumber()
  gpaPoints?: number;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class UpdateEnrollmentStatusDto {
  @ApiProperty({
    description: 'New enrollment status',
    enum: ENROLLMENT_STATUSES,
  })
  @IsString()
  @IsIn(ENROLLMENT_STATUSES)
  status: (typeof ENROLLMENT_STATUSES)[number];
}
