import { IsString, IsOptional, IsObject, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TenantStatus } from '@workspace/api';

/**
 * Update Tenant Status DTO
 */
export class UpdateTenantStatusDto {
  @ApiProperty({
    description: 'New status',
    enum: TenantStatus,
    example: TenantStatus.ACTIVE,
  })
  @IsEnum(TenantStatus)
  status: TenantStatus;

  @ApiPropertyOptional({
    description: 'Reason for status change',
    example: 'Verified payment and documentation',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}

/**
 * Update Tenant Configuration DTO
 */
export class UpdateTenantConfigurationDto {
  @ApiPropertyOptional({ description: 'School display name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Verified school email domain' })
  @IsOptional()
  @IsString()
  emailDomain?: string;

  @ApiPropertyOptional({
    description: 'Settings (JSON object)',
    example: {
      timezone: 'Africa/Lagos',
      currency: 'NGN',
      academicYearStart: '09-01',
    },
  })
  @IsOptional()
  @IsObject()
  settings?: Record<string, any>;
}

/**
 * Validate Email Domain DTO
 */
export class ValidateEmailDomainDto {
  @ApiProperty({
    description: 'Email domain to validate',
    example: 'greenfieldsecondary.edu.ng',
  })
  @IsString()
  emailDomain: string;
}
