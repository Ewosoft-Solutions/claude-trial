import { IsDateString, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const EVENT_STATUSES = ['scheduled', 'ongoing', 'completed', 'cancelled'] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

export class CreateEventDto {
  @ApiProperty({ example: 'Inter-house Sports Day' })
  @IsString() @IsNotEmpty() title!: string;

  @ApiPropertyOptional({ example: 'Annual inter-house athletics competition' })
  @IsOptional() @IsString() description?: string;

  @ApiPropertyOptional({ example: 'sports' })
  @IsOptional() @IsString() eventType?: string;

  @ApiPropertyOptional({ example: 'School sports field' })
  @IsOptional() @IsString() location?: string;

  @ApiProperty({ example: '2026-08-14T08:00:00.000Z' })
  @IsDateString() startDate!: string;

  @ApiPropertyOptional({ example: '2026-08-14T16:00:00.000Z' })
  @IsOptional() @IsDateString() endDate?: string;

  @ApiPropertyOptional({ example: 500 })
  @IsOptional() @IsInt() @Min(0) capacity?: number;
}

export class UpdateEventDto {
  @ApiPropertyOptional({ example: 'Inter-house Sports Day (Rescheduled)' })
  @IsOptional() @IsString() title?: string;

  @ApiPropertyOptional({ example: 'Annual inter-house athletics competition' })
  @IsOptional() @IsString() description?: string;

  @ApiPropertyOptional({ example: 'sports' })
  @IsOptional() @IsString() eventType?: string;

  @ApiPropertyOptional({ example: 'School sports field' })
  @IsOptional() @IsString() location?: string;

  @ApiPropertyOptional({ example: '2026-08-15T08:00:00.000Z' })
  @IsOptional() @IsDateString() startDate?: string;

  @ApiPropertyOptional({ example: '2026-08-15T16:00:00.000Z' })
  @IsOptional() @IsDateString() endDate?: string;

  @ApiPropertyOptional({ enum: EVENT_STATUSES, example: 'ongoing' })
  @IsOptional() @IsIn(EVENT_STATUSES) status?: EventStatus;

  @ApiPropertyOptional({ example: 500 })
  @IsOptional() @IsInt() @Min(0) capacity?: number;

  @ApiPropertyOptional({ example: 120 })
  @IsOptional() @IsInt() @Min(0) registeredCount?: number;
}

export class ListEventsDto {
  @ApiPropertyOptional({ enum: EVENT_STATUSES, example: 'scheduled' })
  @IsOptional() @IsIn(EVENT_STATUSES) status?: EventStatus;

  @ApiPropertyOptional({ example: 'sports' })
  @IsOptional() @IsString() eventType?: string;

  @ApiPropertyOptional({ example: 'Sports Day', description: 'Free-text search across title' })
  @IsOptional() @IsString() query?: string;
}
