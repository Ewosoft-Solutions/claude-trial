import {
  IsString,
  IsEmail,
  IsArray,
  IsOptional,
  IsUUID,
  ArrayMinSize,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Create User Directly DTO
 */
export class CreateUserDto {
  @ApiProperty({ description: 'Email address', example: 'jane.doe@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Password', example: 'StrongP@ssw0rd!' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({ description: 'First name', example: 'Jane' })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({ description: 'Last name', example: 'Doe' })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({ description: 'Phone number', example: '+234-801-234-5678' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({
    description: 'Role IDs to assign',
    type: [String],
    example: ['a1b2c3d4-e5f6-4789-9abc-def012345678'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  roleIds: string[];
}

/**
 * Bulk Create Users DTO
 */
export class BulkCreateUsersDto {
  @ApiProperty({
    description: 'Array of users to create',
    type: [CreateUserDto],
  })
  @IsArray()
  @ArrayMinSize(1)
  users: CreateUserDto[];
}

/**
 * Add User to Tenant DTO
 */
export class AddUserToTenantDto {
  @ApiProperty({ description: 'User ID', example: 'a1b2c3d4-e5f6-4789-9abc-def012345678' })
  @IsUUID('4')
  userId: string;

  @ApiProperty({
    description: 'Role IDs to assign',
    type: [String],
    example: ['a1b2c3d4-e5f6-4789-9abc-def012345678'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  roleIds: string[];
}

/**
 * Update User DTO
 */
export class UpdateUserDto {
  @ApiPropertyOptional({ description: 'First name', example: 'Jane' })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({ description: 'Last name', example: 'Doe' })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({ description: 'Phone number', example: '+234-801-234-5678' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ description: 'Is active', example: true })
  @IsOptional()
  isActive?: boolean;
}

/**
 * Update User Profile DTO (for tenant-specific profile)
 */
export class UpdateUserProfileDto {
  @ApiPropertyOptional({ description: 'Profile status', example: 'active' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({
    description: 'Role IDs to assign',
    type: [String],
    example: ['a1b2c3d4-e5f6-4789-9abc-def012345678'],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  roleIds?: string[];
}
