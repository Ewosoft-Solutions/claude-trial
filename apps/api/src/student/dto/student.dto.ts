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
  IsEmail,
  IsBoolean,
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
  @ApiProperty({ description: 'Document name', example: 'Birth Certificate' })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiProperty({ description: 'Document URL', example: 'https://files.schoolwithease.com/docs/birth-cert-001.pdf' })
  @IsUrl()
  url: string;

  @ApiPropertyOptional({ description: 'Document type (e.g., pdf, image)', example: 'pdf' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  type?: string;

  @ApiPropertyOptional({ description: 'Optional description', example: 'Certified copy submitted at admission' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class CreateStudentDto {
  @ApiProperty({ description: 'Student number (unique per tenant)', example: 'STU-2025-0042' })
  @IsString()
  studentNumber: string;

  @ApiProperty({ description: 'UserTenant profile ID for the student', example: 'a1b2c3d4-e5f6-4789-9abc-def012345678' })
  @IsString()
  userTenantId: string;

  @ApiPropertyOptional({ description: 'Admission number', example: 'ADM-2025-0042' })
  @IsOptional()
  @IsString()
  admissionNumber?: string;

  @ApiPropertyOptional({ description: 'Admission date', example: '2025-09-01' })
  @IsOptional()
  @IsDateString()
  admissionDate?: string;

  @ApiPropertyOptional({ description: 'Grade level (e.g., 9, 10, K)', example: '9' })
  @IsOptional()
  @IsString()
  gradeLevel?: string;

  @ApiPropertyOptional({
    description: 'Enrollment status',
    enum: STUDENT_ENROLLMENT_STATUSES,
    default: 'active',
    example: 'active',
  })
  @IsOptional()
  @IsIn(STUDENT_ENROLLMENT_STATUSES)
  enrollmentStatus?: (typeof STUDENT_ENROLLMENT_STATUSES)[number] = 'active';

  @ApiPropertyOptional({ description: 'Enrollment date', example: '2025-09-01' })
  @IsOptional()
  @IsDateString()
  enrollmentDate?: string;

  @ApiPropertyOptional({ description: 'Graduation date', example: '2029-06-30' })
  @IsOptional()
  @IsDateString()
  graduationDate?: string;

  @ApiPropertyOptional({ description: 'Withdrawal date', example: '2026-01-15' })
  @IsOptional()
  @IsDateString()
  withdrawalDate?: string;

  @ApiPropertyOptional({ description: 'Transfer date', example: '2026-01-15' })
  @IsOptional()
  @IsDateString()
  transferDate?: string;

  @ApiPropertyOptional({
    description: 'Personal information (JSON)',
    example: { dateOfBirth: '2011-04-12', gender: 'female', nationality: 'Nigerian' },
  })
  @IsOptional()
  @IsObject()
  personalInfo?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Academic information (JSON)',
    example: { previousSchool: 'Sunrise Primary School', stream: 'Science' },
  })
  @IsOptional()
  @IsObject()
  academicInfo?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Health information (JSON)',
    example: { bloodGroup: 'O+', allergies: ['peanuts'] },
  })
  @IsOptional()
  @IsObject()
  healthInfo?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Emergency contacts (array)',
    example: [{ name: 'Mrs. E. Achebe', relationship: 'Mother', phone: '+234-801-234-5678' }],
  })
  @IsOptional()
  @IsArray()
  emergencyContacts?: any[];

  @ApiPropertyOptional({
    description: 'Special needs (array)',
    example: ['dyslexia support'],
  })
  @IsOptional()
  @IsArray()
  specialNeeds?: any[];
}

export class UpdateStudentDto {
  @ApiPropertyOptional({ description: 'Student number (unique per tenant)', example: 'STU-2025-0042' })
  @IsOptional()
  @IsString()
  studentNumber?: string;

  @ApiPropertyOptional({ description: 'Admission number', example: 'ADM-2025-0042' })
  @IsOptional()
  @IsString()
  admissionNumber?: string;

  @ApiPropertyOptional({ description: 'Admission date', example: '2025-09-01' })
  @IsOptional()
  @IsDateString()
  admissionDate?: string;

  @ApiPropertyOptional({ description: 'Grade level (e.g., 9, 10, K)', example: '9' })
  @IsOptional()
  @IsString()
  gradeLevel?: string;

  @ApiPropertyOptional({
    description: 'Enrollment status',
    enum: STUDENT_ENROLLMENT_STATUSES,
    example: 'active',
  })
  @IsOptional()
  @IsIn(STUDENT_ENROLLMENT_STATUSES)
  enrollmentStatus?: (typeof STUDENT_ENROLLMENT_STATUSES)[number];

  @ApiPropertyOptional({ description: 'Enrollment date', example: '2025-09-01' })
  @IsOptional()
  @IsDateString()
  enrollmentDate?: string;

  @ApiPropertyOptional({ description: 'Graduation date', example: '2029-06-30' })
  @IsOptional()
  @IsDateString()
  graduationDate?: string;

  @ApiPropertyOptional({ description: 'Withdrawal date', example: '2026-01-15' })
  @IsOptional()
  @IsDateString()
  withdrawalDate?: string;

  @ApiPropertyOptional({ description: 'Transfer date', example: '2026-01-15' })
  @IsOptional()
  @IsDateString()
  transferDate?: string;

  @ApiPropertyOptional({
    description: 'Personal information (JSON)',
    example: { dateOfBirth: '2011-04-12', gender: 'female', nationality: 'Nigerian' },
  })
  @IsOptional()
  @IsObject()
  personalInfo?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Academic information (JSON)',
    example: { previousSchool: 'Sunrise Primary School', stream: 'Science' },
  })
  @IsOptional()
  @IsObject()
  academicInfo?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Health information (JSON)',
    example: { bloodGroup: 'O+', allergies: ['peanuts'] },
  })
  @IsOptional()
  @IsObject()
  healthInfo?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Emergency contacts (array)',
    example: [{ name: 'Mrs. E. Achebe', relationship: 'Mother', phone: '+234-801-234-5678' }],
  })
  @IsOptional()
  @IsArray()
  emergencyContacts?: any[];

  @ApiPropertyOptional({
    description: 'Special needs (array)',
    example: ['dyslexia support'],
  })
  @IsOptional()
  @IsArray()
  specialNeeds?: any[];
}

export class UpdateStudentStatusDto {
  @ApiProperty({
    description: 'New enrollment status',
    enum: STUDENT_ENROLLMENT_STATUSES,
    example: 'graduated',
  })
  @IsString()
  @IsIn(STUDENT_ENROLLMENT_STATUSES)
  enrollmentStatus: (typeof STUDENT_ENROLLMENT_STATUSES)[number];

  @ApiPropertyOptional({ description: 'Graduation date', example: '2029-06-30' })
  @IsOptional()
  @IsDateString()
  graduationDate?: string;

  @ApiPropertyOptional({ description: 'Withdrawal date', example: '2026-01-15' })
  @IsOptional()
  @IsDateString()
  withdrawalDate?: string;

  @ApiPropertyOptional({ description: 'Transfer date', example: '2026-01-15' })
  @IsOptional()
  @IsDateString()
  transferDate?: string;

  @ApiPropertyOptional({ description: 'Enrollment date', example: '2025-09-01' })
  @IsOptional()
  @IsDateString()
  enrollmentDate?: string;
}

export class UpdateStudentProfileDto {
  @ApiPropertyOptional({
    description: 'Personal information (JSON)',
    example: { dateOfBirth: '2011-04-12', gender: 'female', nationality: 'Nigerian' },
  })
  @IsOptional()
  @IsObject()
  personalInfo?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Academic information (JSON)',
    example: { previousSchool: 'Sunrise Primary School', stream: 'Science' },
  })
  @IsOptional()
  @IsObject()
  academicInfo?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Health information (JSON)',
    example: { bloodGroup: 'O+', allergies: ['peanuts'] },
  })
  @IsOptional()
  @IsObject()
  healthInfo?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Emergency contacts (array)',
    example: [{ name: 'Mrs. E. Achebe', relationship: 'Mother', phone: '+234-801-234-5678' }],
  })
  @IsOptional()
  @IsArray()
  emergencyContacts?: any[];

  @ApiPropertyOptional({
    description: 'Special needs (array)',
    example: ['dyslexia support'],
  })
  @IsOptional()
  @IsArray()
  specialNeeds?: any[];

  @ApiPropertyOptional({ description: 'Student photo URL', example: 'https://files.schoolwithease.com/photos/stu-2025-0042.jpg' })
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
    example: 'Achebe',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by enrollment status', enum: STUDENT_ENROLLMENT_STATUSES, example: 'active' })
  @IsOptional()
  @IsIn(STUDENT_ENROLLMENT_STATUSES)
  enrollmentStatus?: (typeof STUDENT_ENROLLMENT_STATUSES)[number];

  @ApiPropertyOptional({ description: 'Filter by grade level', example: '9' })
  @IsOptional()
  @IsString()
  gradeLevel?: string;

  @ApiPropertyOptional({ description: 'Filter by student number', example: 'STU-2025-0042' })
  @IsOptional()
  @IsString()
  studentNumber?: string;
}

export class EnrollStudentDto {
  @ApiProperty({ description: 'Class ID to enroll the student in', example: 'c2d3e4f5-a6b7-4890-9bcd-ef0123456789' })
  @IsString()
  classId: string;

  @ApiProperty({ description: 'Academic year ID', example: 'd3e4f5a6-b7c8-4901-9cde-f01234567890' })
  @IsString()
  academicYearId: string;

  @ApiProperty({ description: 'Term ID', example: 'e4f5a6b7-c8d9-4012-9def-012345678901' })
  @IsString()
  termId: string;

  @ApiPropertyOptional({ description: 'Enrollment date', example: '2025-09-01' })
  @IsOptional()
  @IsDateString()
  enrollmentDate?: string;

  @ApiPropertyOptional({
    description: 'Enrollment status',
    enum: ENROLLMENT_STATUSES,
    example: 'active',
    default: 'active',
  })
  @IsOptional()
  @IsIn(ENROLLMENT_STATUSES)
  status?: (typeof ENROLLMENT_STATUSES)[number] = 'active';

  @ApiPropertyOptional({
    description: 'Final grade (for bulk import or updates)',
    example: 'A',
  })
  @IsOptional()
  @IsString()
  finalGrade?: string;

  @ApiPropertyOptional({ description: 'Credits earned', example: 3 })
  @IsOptional()
  @IsNumber()
  creditsEarned?: number;

  @ApiPropertyOptional({ description: 'GPA points', example: 3.8 })
  @IsOptional()
  @IsNumber()
  gpaPoints?: number;

  @ApiPropertyOptional({ description: 'Notes', example: 'Transferred from JSS 1B due to class size' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class UpdateEnrollmentStatusDto {
  @ApiProperty({
    description: 'New enrollment status',
    enum: ENROLLMENT_STATUSES,
    example: 'completed',
  })
  @IsString()
  @IsIn(ENROLLMENT_STATUSES)
  status: (typeof ENROLLMENT_STATUSES)[number];
}

export class BulkGuardianUpsertItemDto {
  @ApiPropertyOptional({ description: 'Student ID (if known)', example: 'a1b2c3d4-e5f6-4789-9abc-def012345678' })
  @IsOptional()
  @IsString()
  studentId?: string;

  @ApiPropertyOptional({ description: 'Student number (tenant-scoped unique)', example: 'STU-2025-0042' })
  @IsOptional()
  @IsString()
  studentNumber?: string;

  @ApiPropertyOptional({ description: 'Guardian email (unique per user)', example: 'e.achebe@example.com' })
  @IsOptional()
  @IsEmail()
  guardianEmail?: string;

  @ApiPropertyOptional({ description: 'Guardian phone number', example: '+234-801-234-5678' })
  @IsOptional()
  @IsString()
  guardianPhone?: string;

  @ApiPropertyOptional({
    description: 'External guardian identifier (for deduplication)',
    example: 'GUARD-2025-0010',
  })
  @IsOptional()
  @IsString()
  guardianId?: string;

  @ApiPropertyOptional({ description: 'Guardian first name', example: 'Ezinne' })
  @IsOptional()
  @IsString()
  guardianFirstName?: string;

  @ApiPropertyOptional({ description: 'Guardian last name', example: 'Achebe' })
  @IsOptional()
  @IsString()
  guardianLastName?: string;

  @ApiPropertyOptional({
    description: 'Display name (optional, otherwise derived)',
    example: 'Mrs. E. Achebe',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  displayName?: string;

  @ApiPropertyOptional({
    description: 'Relationship to student',
    enum: ['parent', 'guardian', 'other'],
    example: 'parent',
    default: 'parent',
  })
  @IsOptional()
  @IsString()
  relationship?: string = 'parent';

  @ApiPropertyOptional({ description: 'Primary guardian flag', example: true })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean = false;

  @ApiPropertyOptional({ description: 'Legal guardian flag', example: true })
  @IsOptional()
  @IsBoolean()
  legalGuardian?: boolean = false;

  @ApiPropertyOptional({
    description: 'Contact priority (lower = higher priority)',
    example: 1,
  })
  @IsOptional()
  @IsNumber()
  contactPriority?: number;
}

export class BulkGuardianUpsertDto {
  @ApiProperty({
    description: 'Guardian rows to upsert',
    type: [BulkGuardianUpsertItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkGuardianUpsertItemDto)
  items: BulkGuardianUpsertItemDto[];
}
