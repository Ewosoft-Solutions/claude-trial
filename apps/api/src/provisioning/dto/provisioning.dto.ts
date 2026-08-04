import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/** WB1-3 account-provisioning request bodies. */

export class InvitePersonDto {
  @ApiProperty({ description: 'Role to grant the invited account' })
  @IsUUID()
  roleId: string;

  @ApiPropertyOptional({
    description:
      "Where to send the invite; defaults to the person's primary email contact",
  })
  @IsOptional()
  @IsEmail()
  email?: string;

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

  @ApiPropertyOptional({
    description: 'Invitation lifetime in hours (default 168 = 7 days)',
    minimum: 1,
    maximum: 720,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(720)
  expirationHours?: number;
}

export class SuspendAccountDto {
  @ApiPropertyOptional({ example: 'Left the organisation' })
  @IsOptional()
  @IsString()
  @MaxLength(240)
  reason?: string;
}
