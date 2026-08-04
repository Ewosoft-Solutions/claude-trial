import { IsIn, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/** The table sizes offered in the UI; the preference must be one of these. */
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

export class UpdatePreferencesDto {
  @ApiPropertyOptional({
    description: 'Preferred table rows-per-page (per-account UI preference).',
    enum: PAGE_SIZE_OPTIONS,
    example: 25,
  })
  @IsOptional()
  @IsIn(PAGE_SIZE_OPTIONS)
  defaultPageSize?: (typeof PAGE_SIZE_OPTIONS)[number];
}
