import {
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ListJournalDto {
  @ApiPropertyOptional({ example: '2026-08-01' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-08-31' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({
    description:
      'invoice | adjustment | receipt | credit_application | opening | reversal',
  })
  @IsOptional()
  @IsString()
  sourceType?: string;

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}

export class TrialBalanceQueryDto {
  @ApiPropertyOptional({ example: '2026-08-01' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-08-31' })
  @IsOptional()
  @IsDateString()
  to?: string;
}

export class CreatePeriodDto {
  @ApiProperty({ example: 'First Term 2026/27' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: '2026-09-01' })
  @IsDateString()
  startDate!: string;

  @ApiProperty({ example: '2026-12-31' })
  @IsDateString()
  endDate!: string;
}

export class SetPeriodStatusDto {
  @ApiProperty({ enum: ['open', 'closed'], example: 'closed' })
  @IsIn(['open', 'closed'])
  status!: 'open' | 'closed';
}

export class ReverseEntryDto {
  @ApiPropertyOptional({
    example: 'Receipt was recorded against the wrong family',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
