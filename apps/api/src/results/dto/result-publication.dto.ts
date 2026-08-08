/**
 * WB4 · Publication + amendment DTOs — submit a cycle for publish approval,
 * approve/reject as the second approver, and raise a post-publication amendment.
 */
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ReviewDto {
  @ApiPropertyOptional({
    description: 'Reason recorded on the approval/rejection',
  })
  @IsOptional()
  @IsString()
  @MaxLength(240)
  reason?: string;
}

export class AmendmentChangeDto {
  @ApiProperty()
  @IsString()
  @MaxLength(64)
  studentId: string;

  @ApiProperty()
  @IsString()
  @MaxLength(64)
  subjectOfferingId: string;

  @ApiProperty({ example: 'EXAM' })
  @IsString()
  @MaxLength(24)
  componentKey: string;

  @ApiProperty({ description: 'Corrected score (null = absent)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000)
  score?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isAbsent?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isExempt?: boolean;
}

export class CreateAmendmentDto {
  @ApiProperty({ description: 'Why the published result is being corrected' })
  @IsString()
  @MaxLength(500)
  reason: string;

  @ApiProperty({ type: [AmendmentChangeDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => AmendmentChangeDto)
  changes: AmendmentChangeDto[];
}
