import {
  IsString,
  IsEmail,
  IsOptional,
  IsUUID,
  IsNotEmpty,
  IsArray,
  ArrayMinSize,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Create User Invitation DTO
 */
export class CreateInvitationDto {
  @ApiProperty({ description: 'Email address to invite', example: 'jane.doe@example.com' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ description: 'First name', example: 'Jane' })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({ description: 'Last name', example: 'Doe' })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiProperty({ description: 'Role ID to assign', example: 'a1b2c3d4-e5f6-4789-9abc-def012345678' })
  @IsUUID('4')
  @IsNotEmpty()
  roleId: string;

  @ApiPropertyOptional({
    description: 'Invitation expiration in hours (default: 168 = 7 days)',
    example: 168,
  })
  @IsOptional()
  expirationHours?: number;
}

/**
 * Bulk Create Invitations DTO
 */
export class BulkCreateInvitationsDto {
  @ApiProperty({
    description: 'Array of invitations',
    type: [CreateInvitationDto],
  })
  @IsArray()
  @ArrayMinSize(1)
  invitations: CreateInvitationDto[];
}

/**
 * Accept Invitation DTO
 */
export class AcceptInvitationDto {
  @ApiProperty({ description: 'Invitation token', example: 'a1b2c3d4e5f6789012345678abcdef01' })
  @IsString()
  token: string;

  @ApiProperty({ description: 'Password for the account', example: 'StrongP@ssw0rd!' })
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
}
