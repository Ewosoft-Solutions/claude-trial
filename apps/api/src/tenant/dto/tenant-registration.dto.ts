import {
  IsString,
  IsEmail,
  IsOptional,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Register Tenant DTO
 */
export class RegisterTenantDto {
  @ApiProperty({ description: 'School name', example: 'Greenfield Secondary School' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional({ description: 'School slug (unique identifier)', example: 'greenfield-secondary' })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Slug must contain only lowercase letters, numbers, and hyphens',
  })
  @MinLength(2)
  @MaxLength(50)
  slug?: string;

  @ApiPropertyOptional({
    description: 'Email domain for validation (e.g., example.com)',
    example: 'greenfieldsecondary.edu.ng',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  emailDomain?: string;

  @ApiPropertyOptional({
    description: 'Initial settings (JSON object)',
    example: { timezone: 'Africa/Lagos', currency: 'NGN' },
  })
  @IsOptional()
  settings?: Record<string, any>;
}

/**
 * Update Tenant DTO
 */
export class UpdateTenantDto {
  @ApiPropertyOptional({ description: 'School name', example: 'Greenfield Secondary School' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ description: 'School slug (unique identifier)', example: 'greenfield-secondary' })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Slug must contain only lowercase letters, numbers, and hyphens',
  })
  @MinLength(2)
  @MaxLength(50)
  slug?: string;

  @ApiPropertyOptional({ description: 'Email domain for validation', example: 'greenfieldsecondary.edu.ng' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  emailDomain?: string;

  @ApiPropertyOptional({
    description: 'Settings (JSON object)',
    example: { timezone: 'Africa/Lagos', currency: 'NGN' },
  })
  @IsOptional()
  settings?: Record<string, any>;
}
