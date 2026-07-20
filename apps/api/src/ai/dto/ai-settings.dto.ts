import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

/** Model tiers a tenant may select (end users never choose raw model ids). */
export const AI_MODEL_TIERS = ['standard', 'premium'] as const;
/** BYOK providers we accept a tenant-managed key for. */
export const AI_BYOK_PROVIDERS = ['anthropic'] as const;

/**
 * A proposed change to a tenant's AI settings. Every field is optional — only
 * the provided fields are patched. Submitting this creates a maker-checker
 * request; the change applies only once a *different* approver accepts it.
 */
export class AiSettingsChangeRequestDto {
  @ApiPropertyOptional({ enum: AI_MODEL_TIERS })
  @IsOptional()
  @IsIn(AI_MODEL_TIERS)
  modelTier?: (typeof AI_MODEL_TIERS)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  analyticsEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  tutorEnabled?: boolean;

  @ApiPropertyOptional({ minimum: 0, maximum: 1_000_000_000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000_000)
  monthlyTokenBudget?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 1000 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  concurrencyLimit?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  alertThresholdPercent?: number;

  /**
   * Bring-your-own-key provider. Send `null` to clear BYOK and fall back to the
   * platform-managed key. When set, `byokApiKey` must also be provided.
   */
  @ApiPropertyOptional({ enum: AI_BYOK_PROVIDERS, nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsIn(AI_BYOK_PROVIDERS)
  byokProvider?: (typeof AI_BYOK_PROVIDERS)[number] | null;

  /**
   * Plaintext BYOK key — write-only, never returned. Stored encrypted at rest;
   * only the last 4 chars are ever surfaced. Ignored unless `byokProvider` is set.
   */
  @ApiPropertyOptional({ writeOnly: true })
  @IsOptional()
  @IsString()
  @MaxLength(400)
  byokApiKey?: string;

  /** Optional note carried on the approval request for the checker. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

/** Approve/reject a pending AI-settings change. */
export class AiSettingsDecisionDto {
  @ApiPropertyOptional({ description: 'Reason recorded on the decision.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class AiSettingsRejectDto {
  @ApiProperty({ description: 'Why the change was rejected (required).' })
  @IsString()
  @MaxLength(500)
  reason!: string;
}
