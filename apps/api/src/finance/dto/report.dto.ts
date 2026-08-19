import { IsDateString, IsIn, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CollectionsQueryDto {
  @ApiPropertyOptional({ example: '2026-08-01' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-08-31' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ enum: ['day', 'method'], example: 'day' })
  @IsOptional()
  @IsIn(['day', 'method'])
  groupBy?: 'day' | 'method';
}

export class AgingQueryDto {
  @ApiPropertyOptional({
    example: '2026-08-19',
    description: 'Age the debt as at this date. Defaults to today.',
  })
  @IsOptional()
  @IsDateString()
  asOf?: string;

  @ApiPropertyOptional({ enum: ['student', 'household'], example: 'student' })
  @IsOptional()
  @IsIn(['student', 'household'])
  groupBy?: 'student' | 'household';
}
