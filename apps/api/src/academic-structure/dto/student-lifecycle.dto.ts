/**
 * DTOs for the WB2-3 student-lifecycle domain — registration, transfer,
 * withdrawal and graduation. Every transition is a durable, effective-dated
 * event that keeps history; these carry only what the transition needs. The
 * class-validator decorators satisfy the global whitelist + forbidNonWhitelisted
 * validation pipe.
 */
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ---- Registration -------------------------------------------------------

export class RegisterStudentDto {
  @ApiProperty({ description: 'The student being placed' })
  @IsString()
  @MaxLength(64)
  studentId: string;

  @ApiProperty({ description: 'The class section (WB2-1) to place them into' })
  @IsString()
  @MaxLength(64)
  classSectionId: string;

  @ApiProperty({ description: 'The academic year of the placement' })
  @IsString()
  @MaxLength(64)
  academicYearId: string;

  @ApiPropertyOptional({ description: 'Why (kept on the placement history)' })
  @IsOptional()
  @IsString()
  @MaxLength(240)
  reason?: string;
}

// ---- Transfer -----------------------------------------------------------

export class TransferStudentDto {
  @ApiProperty({ description: 'The student being transferred' })
  @IsString()
  @MaxLength(64)
  studentId: string;

  @ApiProperty({ description: 'The destination class section (WB2-1)' })
  @IsString()
  @MaxLength(64)
  toClassSectionId: string;

  @ApiPropertyOptional({
    description: 'The academic year (defaults to the current placement year)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  academicYearId?: string;

  @ApiProperty({ description: 'Why the student is being transferred' })
  @IsString()
  @MaxLength(240)
  reason: string;
}

// ---- Withdrawal / graduation --------------------------------------------

export class WithdrawStudentDto {
  @ApiProperty({ description: 'The student being withdrawn' })
  @IsString()
  @MaxLength(64)
  studentId: string;

  @ApiProperty({ description: 'Why the student is being withdrawn' })
  @IsString()
  @MaxLength(240)
  reason: string;
}

export class GraduateStudentDto {
  @ApiProperty({ description: 'The student graduating' })
  @IsString()
  @MaxLength(64)
  studentId: string;

  @ApiPropertyOptional({
    description: 'Any note kept on the placement history',
  })
  @IsOptional()
  @IsString()
  @MaxLength(240)
  reason?: string;
}

// ---- List / filter ------------------------------------------------------

export const PLACEMENT_HISTORY_STATUSES = ['active', 'ended'] as const;

export class ListPlacementHistoryDto {
  @ApiPropertyOptional({ enum: PLACEMENT_HISTORY_STATUSES })
  @IsOptional()
  @IsIn(PLACEMENT_HISTORY_STATUSES)
  status?: (typeof PLACEMENT_HISTORY_STATUSES)[number];
}
