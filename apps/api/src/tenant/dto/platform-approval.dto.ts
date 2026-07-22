import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/** Reason attached when an Architect approves a pending tenant action. */
export class ApprovePlatformRequestDto {
  @ApiPropertyOptional({
    description: 'Optional note recorded with the approval.',
    example: 'Confirmed the school cleared its outstanding invoice.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

/** Reason attached when a pending tenant action is rejected. Required. */
export class RejectPlatformRequestDto {
  @ApiProperty({
    description: 'Why the request is being rejected.',
    example: 'Outstanding compliance issue not yet resolved.',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason: string;
}
