import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

import { RefreshTokenDto } from './refresh-token.dto';

export const LOGOUT_REASONS = [
  'manual',
  'idle',
  'absolute_expiry',
  'refresh_failed',
] as const;

export type LogoutReason = (typeof LOGOUT_REASONS)[number];

export class LogoutDto extends RefreshTokenDto {
  @ApiPropertyOptional({ enum: LOGOUT_REASONS, default: 'manual' })
  @IsOptional()
  @IsIn(LOGOUT_REASONS)
  reason?: LogoutReason;
}
