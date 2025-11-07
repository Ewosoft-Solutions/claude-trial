import { IsString, IsOptional, IsObject, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Tenant Status
 */
export enum TenantStatus {
  ACTIVE = 'active',
  PENDING = 'pending',
  SUSPENDED = 'suspended',
}

/**
 * Update Tenant Status DTO
 */
export class UpdateTenantStatusDto {
  @ApiProperty({ description: 'New status', enum: TenantStatus })
  @IsEnum(TenantStatus)
  status: TenantStatus;

  @ApiPropertyOptional({ description: 'Reason for status change' })
  @IsOptional()
  @IsString()
  reason?: string;
}

/**
 * Update Tenant Configuration DTO
 */
export class UpdateTenantConfigurationDto {
  @ApiPropertyOptional({ description: 'Settings (JSON object)' })
  @IsOptional()
  @IsObject()
  settings?: Record<string, any>;
}

/**
 * Validate Email Domain DTO
 */
export class ValidateEmailDomainDto {
  @ApiProperty({ description: 'Email domain to validate' })
  @IsString()
  emailDomain: string;
}
