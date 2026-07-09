import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, Matches } from 'class-validator';

export class AiUsageQueryDto {
  @ApiPropertyOptional({
    example: '2026-07',
    description: 'UTC month to report, formatted as YYYY-MM. Defaults to the current month.',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}$/)
  month?: string;
}
