import { IsIn, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/** The table sizes offered in the UI; the preference must be one of these. */
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

/** The text-size (font-scale) multipliers offered in the UI (90%–110% in 5%
 *  steps); the preference must be one of these. Kept in lock-step with the
 *  web's FONT_SCALE_STEPS (apps/web/lib/font-scale.ts). */
export const FONT_SCALE_OPTIONS = [0.9, 0.95, 1.0, 1.05, 1.1] as const;

export class UpdatePreferencesDto {
  @ApiPropertyOptional({
    description: 'Preferred table rows-per-page (per-account UI preference).',
    enum: PAGE_SIZE_OPTIONS,
    example: 25,
  })
  @IsOptional()
  @IsIn(PAGE_SIZE_OPTIONS)
  defaultPageSize?: (typeof PAGE_SIZE_OPTIONS)[number];

  @ApiPropertyOptional({
    description:
      'Text-size preference — a font-scale multiplier (per-account UI preference).',
    enum: FONT_SCALE_OPTIONS,
    example: 1.1,
  })
  @IsOptional()
  @IsIn(FONT_SCALE_OPTIONS)
  fontScale?: (typeof FONT_SCALE_OPTIONS)[number];
}
