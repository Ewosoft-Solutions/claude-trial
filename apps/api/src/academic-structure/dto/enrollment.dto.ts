/**
 * DTOs for the WB2-2 enrollment domain — academic profile, section enrollment
 * (K-12), course registration (tertiary), elective election, and teacher
 * assignment to an offering. class-validator decorators satisfy the global
 * whitelist + forbidNonWhitelisted pipe.
 */
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const ENROLLMENT_MODELS = ['class', 'course'] as const;
export const SECTION_ENROLLMENT_STATUSES = [
  'active',
  'transferred',
  'withdrawn',
  'completed',
] as const;
export const REGISTRATION_STATUSES = [
  'registered',
  'dropped',
  'completed',
] as const;
export const ELECTION_STATUSES = ['elected', 'withdrawn'] as const;
export const OFFERING_TEACHER_ROLES = ['teacher', 'assistant'] as const;

// ---- AcademicProfile ----------------------------------------------------

export class CreateAcademicProfileDto {
  @ApiProperty({ example: 'K-12 default' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string;

  @ApiProperty({
    enum: ENROLLMENT_MODELS,
    description:
      "'class' (K-12: enroll into a section) | 'course' (tertiary: per-offering)",
  })
  @IsIn(ENROLLMENT_MODELS)
  enrollmentModel: (typeof ENROLLMENT_MODELS)[number];

  @ApiPropertyOptional({
    description: 'Scope to a campus (omit = tenant-wide)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  campusId?: string;

  @ApiPropertyOptional({ description: 'Make this the default profile' })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateAcademicProfileDto {
  @ApiPropertyOptional({ example: 'K-12 default' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ enum: ENROLLMENT_MODELS })
  @IsOptional()
  @IsIn(ENROLLMENT_MODELS)
  enrollmentModel?: (typeof ENROLLMENT_MODELS)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({ enum: ['active', 'inactive'] })
  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: 'active' | 'inactive';
}

// ---- Section enrollment (K-12) ------------------------------------------

export class EnrollSectionDto {
  @ApiProperty({ description: 'The student' })
  @IsString()
  @MaxLength(64)
  studentId: string;

  @ApiProperty({ description: 'The class section (WB2-1)' })
  @IsString()
  @MaxLength(64)
  classSectionId: string;

  @ApiProperty({ description: 'The academic year' })
  @IsString()
  @MaxLength(64)
  academicYearId: string;
}

export class UpdateSectionEnrollmentDto {
  @ApiPropertyOptional({ enum: SECTION_ENROLLMENT_STATUSES })
  @IsOptional()
  @IsIn(SECTION_ENROLLMENT_STATUSES)
  status?: (typeof SECTION_ENROLLMENT_STATUSES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(240)
  endReason?: string;
}

// ---- Course registration (tertiary) -------------------------------------

export class RegisterCourseDto {
  @ApiProperty({ description: 'The student' })
  @IsString()
  @MaxLength(64)
  studentId: string;

  @ApiProperty({ description: 'The subject offering (WB2-1)' })
  @IsString()
  @MaxLength(64)
  subjectOfferingId: string;
}

export class UpdateCourseRegistrationDto {
  @ApiPropertyOptional({ enum: REGISTRATION_STATUSES })
  @IsOptional()
  @IsIn(REGISTRATION_STATUSES)
  status?: (typeof REGISTRATION_STATUSES)[number];
}

// ---- Elective election --------------------------------------------------

export class ElectSubjectDto {
  @ApiProperty({ description: 'The student' })
  @IsString()
  @MaxLength(64)
  studentId: string;

  @ApiProperty({
    description: 'The elective subject offering (must be isElective)',
  })
  @IsString()
  @MaxLength(64)
  subjectOfferingId: string;
}

export class UpdateElectionDto {
  @ApiPropertyOptional({ enum: ELECTION_STATUSES })
  @IsOptional()
  @IsIn(ELECTION_STATUSES)
  status?: (typeof ELECTION_STATUSES)[number];
}

// ---- Teacher assignment -------------------------------------------------

export class AssignTeacherDto {
  @ApiProperty({ description: 'The subject offering (WB2-1)' })
  @IsString()
  @MaxLength(64)
  subjectOfferingId: string;

  @ApiProperty({ description: "The teacher's profile (UserTenant id)" })
  @IsString()
  @MaxLength(64)
  userTenantId: string;

  @ApiPropertyOptional({ enum: OFFERING_TEACHER_ROLES, default: 'teacher' })
  @IsOptional()
  @IsIn(OFFERING_TEACHER_ROLES)
  role?: (typeof OFFERING_TEACHER_ROLES)[number];
}

export class UpdateOfferingTeacherDto {
  @ApiPropertyOptional({ description: 'Deactivate (unassign) or reactivate' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ enum: OFFERING_TEACHER_ROLES })
  @IsOptional()
  @IsIn(OFFERING_TEACHER_ROLES)
  role?: (typeof OFFERING_TEACHER_ROLES)[number];
}

// ---- List filters -------------------------------------------------------

export class ListSectionEnrollmentsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  classSectionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  studentId?: string;
}

export class ListOfferingTeachersDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  subjectOfferingId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  userTenantId?: string;
}
