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
  @ApiProperty({ description: 'School name' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional({ description: 'School slug (unique identifier)' })
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
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  emailDomain?: string;

  @ApiPropertyOptional({ description: 'Initial settings (JSON object)' })
  @IsOptional()
  settings?: Record<string, any>;
}

/**
 * Update Tenant DTO
 */
export class UpdateTenantDto {
  @ApiPropertyOptional({ description: 'School name' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ description: 'School slug (unique identifier)' })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Slug must contain only lowercase letters, numbers, and hyphens',
  })
  @MinLength(2)
  @MaxLength(50)
  slug?: string;

  @ApiPropertyOptional({ description: 'Email domain for validation' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  emailDomain?: string;

  @ApiPropertyOptional({ description: 'Settings (JSON object)' })
  @IsOptional()
  settings?: Record<string, any>;
}
