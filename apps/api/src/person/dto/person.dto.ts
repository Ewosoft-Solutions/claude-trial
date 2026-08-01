import {
  IsString,
  IsOptional,
  IsIn,
  IsInt,
  IsBoolean,
  IsUUID,
  IsDateString,
  IsObject,
  MaxLength,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../common/dto';

export const PERSON_STATUSES = ['active', 'merged', 'archived'] as const;
export const CONTACT_KINDS = ['email', 'phone'] as const;
export const EMPLOYMENT_STATUSES = [
  'active',
  'on_leave',
  'suspended',
  'terminated',
] as const;

export class CreatePersonDto {
  @ApiProperty({ example: 'Ada' })
  @IsString()
  @MaxLength(120)
  firstName: string;

  @ApiProperty({ example: 'Okafor' })
  @IsString()
  @MaxLength(120)
  lastName: string;

  @ApiPropertyOptional({ example: 'Ngozi' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  middleName?: string;

  @ApiPropertyOptional({ example: 'Ada' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  preferredName?: string;

  @ApiPropertyOptional({ example: '2012-03-05' })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional({ example: 'female' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  gender?: string;

  @ApiPropertyOptional({ example: 'NG', description: 'ISO-3166 alpha-2' })
  @IsOptional()
  @IsString()
  @MaxLength(2)
  nationality?: string;

  @ApiPropertyOptional({ example: 'Anambra' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  stateOfOrigin?: string;

  @ApiPropertyOptional({ example: 'Idemili North' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  lgaOfOrigin?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  religion?: string;

  @ApiPropertyOptional({ description: 'Tenant-extensible attributes (schema per tenant)' })
  @IsOptional()
  @IsObject()
  attributes?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Link an existing account (UserTenant) as this human' })
  @IsOptional()
  @IsUUID()
  userTenantId?: string;

  @ApiPropertyOptional({ description: 'Stable migration source system' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  sourceSystem?: string;

  @ApiPropertyOptional({ description: 'Stable migration source id (idempotent upsert key)' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  sourceId?: string;
}

export class UpdatePersonDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  lastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  middleName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  preferredName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  gender?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2)
  nationality?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  stateOfOrigin?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  lgaOfOrigin?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  religion?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  attributes?: Record<string, unknown>;
}

export class SearchPeopleDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Free-text over name' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  q?: string;

  @ApiPropertyOptional({ enum: PERSON_STATUSES })
  @IsOptional()
  @IsIn(PERSON_STATUSES)
  status?: (typeof PERSON_STATUSES)[number];

  @ApiPropertyOptional({ description: 'Only people with a staff profile' })
  @IsOptional()
  @IsBoolean()
  hasStaffProfile?: boolean;

  @ApiPropertyOptional({ description: 'Only people who are guardians' })
  @IsOptional()
  @IsBoolean()
  isGuardian?: boolean;
}

export class AddContactPointDto {
  @ApiProperty({ enum: CONTACT_KINDS })
  @IsIn(CONTACT_KINDS)
  kind: (typeof CONTACT_KINDS)[number];

  @ApiProperty({ example: 'ada@example.com' })
  @IsString()
  @MaxLength(320)
  value: string;

  @ApiPropertyOptional({ example: 'home' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  label?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

export class ConfirmContactDto {
  @ApiProperty()
  @IsString()
  @MaxLength(255)
  token: string;
}

export class AddStaffProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  employeeNumber?: string;

  @ApiPropertyOptional({ enum: EMPLOYMENT_STATUSES })
  @IsOptional()
  @IsIn(EMPLOYMENT_STATUSES)
  employmentStatus?: (typeof EMPLOYMENT_STATUSES)[number];

  @ApiPropertyOptional({ example: 'full_time' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  employmentType?: string;

  @ApiPropertyOptional({ example: 'Mathematics Teacher' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  jobTitle?: string;

  @ApiPropertyOptional({ example: 'Sciences' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  department?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  hireDate?: string;
}

export class AddGuardianshipDto {
  @ApiProperty({ description: 'The ward (student) Person id this person is a guardian of' })
  @IsUUID()
  wardPersonId: string;

  @ApiPropertyOptional({ example: 'parent' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  relationship?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  legalGuardian?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(99)
  contactPriority?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  consentGiven?: boolean;
}

export class MergePeopleDto {
  @ApiProperty({ description: 'The Person to keep' })
  @IsUUID()
  survivorId: string;

  @ApiProperty({ description: 'The duplicate Person to absorb into the survivor' })
  @IsUUID()
  duplicateId: string;

  @ApiPropertyOptional({ description: 'Why the duplicate is being merged (audit)' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
