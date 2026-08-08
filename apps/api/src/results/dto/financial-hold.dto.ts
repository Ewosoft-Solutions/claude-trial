/**
 * WB4 · FinancialHold DTOs — place or release an explicit, audited hold on a
 * student's result visibility (redesign of the legacy silent per-student block).
 */
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateFinancialHoldDto {
  @ApiProperty()
  @IsString()
  @MaxLength(64)
  studentId: string;

  @ApiProperty({ description: 'Why the hold is placed (audited)' })
  @IsString()
  @MaxLength(500)
  reason: string;

  @ApiPropertyOptional({ description: 'Campus scope (omit = tenant-wide)' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  campusId?: string;
}

export class ReleaseFinancialHoldDto {
  @ApiPropertyOptional({ description: 'Why the hold is released (audited)' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
