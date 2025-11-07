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
  @ApiProperty({ description: 'Email address' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Password' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({ description: 'First name' })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({ description: 'Last name' })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({ description: 'Phone number' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ description: 'Role IDs to assign', type: [String] })
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
  @ApiProperty({ description: 'User ID' })
  @IsUUID('4')
  userId: string;

  @ApiProperty({ description: 'Role IDs to assign', type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  roleIds: string[];
}
