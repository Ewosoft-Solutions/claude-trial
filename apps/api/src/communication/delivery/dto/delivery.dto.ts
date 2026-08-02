import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  ArrayMaxSize,
  ArrayNotEmpty,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const DELIVERY_CHANNELS = ['sms', 'email', 'push', 'in_app'] as const;
export const DELIVERY_CATEGORIES = [
  'transactional',
  'critical',
  'marketing',
] as const;

export class ListDeliveryAttemptsDto {
  @ApiPropertyOptional({ enum: DELIVERY_CHANNELS })
  @IsOptional()
  @IsIn(DELIVERY_CHANNELS as unknown as string[])
  channel?: string;

  @ApiPropertyOptional({ description: 'Filter by delivery status' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  campaignId?: string;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}

export class SetContactPreferenceDto {
  @ApiProperty({ enum: DELIVERY_CHANNELS })
  @IsIn(DELIVERY_CHANNELS as unknown as string[])
  channel: string;

  @ApiPropertyOptional({ description: 'Consent for non-critical sends.' })
  @IsOptional()
  @IsBoolean()
  optedIn?: boolean;

  @ApiPropertyOptional({ description: 'Do-Not-Disturb (affects SMS cost).' })
  @IsOptional()
  @IsBoolean()
  isDnd?: boolean;

  @ApiPropertyOptional({ example: 'guardian' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  consentSource?: string;

  @ApiPropertyOptional({
    description: 'Quiet hours start (minutes past midnight, UTC).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1440)
  quietHoursStart?: number;

  @ApiPropertyOptional({
    description: 'Quiet hours end (minutes past midnight, UTC).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1440)
  quietHoursEnd?: number;
}

export class CreateSecureLinkDto {
  @ApiProperty({ example: 'result' })
  @IsString()
  @MaxLength(40)
  purpose: string;

  @ApiProperty({ example: 'result_publication' })
  @IsString()
  @MaxLength(60)
  targetType: string;

  @ApiProperty()
  @IsString()
  @MaxLength(200)
  targetId: string;

  @ApiProperty({
    description: 'Time-to-live in seconds (expiry is mandatory).',
  })
  @Type(() => Number)
  @IsInt()
  @Min(60)
  @Max(60 * 60 * 24 * 30)
  ttlSeconds: number;

  @ApiPropertyOptional({ example: 'results.view' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  requiredPermission?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  audiencePersonId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  audienceProfileId?: string;

  @ApiPropertyOptional({
    description: 'Max redemptions before the link is spent.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  maxUses?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class CreateCampaignDto {
  @ApiProperty({ example: 'PTA meeting reminder' })
  @IsString()
  @MaxLength(160)
  name: string;

  @ApiProperty({ enum: DELIVERY_CHANNELS })
  @IsIn(DELIVERY_CHANNELS as unknown as string[])
  channel: string;

  @ApiPropertyOptional({ enum: DELIVERY_CATEGORIES, default: 'marketing' })
  @IsOptional()
  @IsIn(DELIVERY_CATEGORIES as unknown as string[])
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  audience?: Record<string, unknown>;
}

export class SendCampaignDto {
  @ApiProperty({ type: [String], description: 'Recipient person ids.' })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(5000)
  @IsUUID('all', { each: true })
  recipientPersonIds: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  subject?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  body?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  variables?: Record<string, unknown>;
}

export class CreateTemplateDto {
  @ApiProperty({ example: 'result.published' })
  @IsString()
  @MaxLength(80)
  key: string;

  @ApiProperty({ example: 'Result published notice' })
  @IsString()
  @MaxLength(160)
  name: string;

  @ApiPropertyOptional({ enum: DELIVERY_CATEGORIES })
  @IsOptional()
  @IsIn(DELIVERY_CATEGORIES as unknown as string[])
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(400)
  description?: string;
}

export class AddTemplateVersionDto {
  @ApiProperty({ enum: DELIVERY_CHANNELS })
  @IsIn(DELIVERY_CHANNELS as unknown as string[])
  channel: string;

  @ApiPropertyOptional({ default: 'en' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  locale?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  subject?: string;

  @ApiProperty({ description: 'Body with {{placeholders}}.' })
  @IsString()
  @MaxLength(4000)
  body: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  variables?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Publish immediately.' })
  @IsOptional()
  @IsBoolean()
  publish?: boolean;
}
