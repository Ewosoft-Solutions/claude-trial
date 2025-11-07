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
 * Create User Invitation DTO
 */
export class CreateInvitationDto {
  @ApiProperty({ description: 'Email address to invite' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ description: 'First name' })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({ description: 'Last name' })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiProperty({ description: 'Role IDs to assign', type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  roleIds: string[];

  @ApiPropertyOptional({
    description: 'Invitation expiration in hours (default: 168 = 7 days)',
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
  @ApiProperty({ description: 'Invitation token' })
  @IsString()
  token: string;

  @ApiProperty({ description: 'Password for the account' })
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
}
