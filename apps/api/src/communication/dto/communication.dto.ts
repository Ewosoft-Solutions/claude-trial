import {
  IsArray,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../common/dto';

export const ANNOUNCEMENT_TARGET_TYPES = [
  'all',
  'students',
  'parents',
  'teachers',
  'staff',
  'class',
  'grade_level',
  'custom',
] as const;

export const ANNOUNCEMENT_PRIORITIES = ['normal', 'important', 'urgent'] as const;
export const ANNOUNCEMENT_STATUSES = ['draft', 'published', 'archived'] as const;

export const MESSAGE_CONTENT_TYPES = ['text', 'html', 'markdown'] as const;
export const MESSAGE_STATUSES = ['draft', 'sent', 'delivered', 'read', 'archived'] as const;

export class CreateAnnouncementDto {
  @ApiProperty({ description: 'Target audience type', enum: ANNOUNCEMENT_TARGET_TYPES, example: 'parents' })
  @IsString()
  @IsIn(ANNOUNCEMENT_TARGET_TYPES)
  targetType: (typeof ANNOUNCEMENT_TARGET_TYPES)[number];

  @ApiPropertyOptional({
    description: 'Target IDs (class IDs, grade levels, or user IDs depending on targetType)',
    example: ['c2d3e4f5-a6b7-4890-9bcd-ef0123456789'],
  })
  @IsOptional()
  @IsArray()
  targetIds?: string[];

  @ApiProperty({ description: 'Title', example: 'Mid-term exam schedule released' })
  @IsString()
  @MaxLength(255)
  title: string;

  @ApiProperty({ description: 'Content', example: 'The mid-term examination timetable has been published. Please check the portal for your class schedule.' })
  @IsString()
  content: string;

  @ApiPropertyOptional({ description: 'Summary/preview', example: 'Mid-term exam timetable is now available.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  summary?: string;

  @ApiPropertyOptional({ description: 'Priority', enum: ANNOUNCEMENT_PRIORITIES, example: 'important' })
  @IsOptional()
  @IsIn(ANNOUNCEMENT_PRIORITIES)
  priority?: (typeof ANNOUNCEMENT_PRIORITIES)[number];

  @ApiPropertyOptional({ description: 'Status', enum: ANNOUNCEMENT_STATUSES, default: 'draft', example: 'published' })
  @IsOptional()
  @IsIn(ANNOUNCEMENT_STATUSES)
  status?: (typeof ANNOUNCEMENT_STATUSES)[number] = 'draft';

  @ApiPropertyOptional({ description: 'Publish at (schedule)', example: '2025-03-15T08:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  publishAt?: string;

  @ApiPropertyOptional({ description: 'Expires at', example: '2025-04-15T08:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional({ description: 'Attachments JSON array', example: [{ name: 'timetable.pdf', url: 'https://files.example.com/timetable.pdf' }] })
  @IsOptional()
  attachments?: any;

  @ApiPropertyOptional({ description: 'Metadata JSON', example: { source: 'admin-portal' } })
  @IsOptional()
  metadata?: any;
}

export class UpdateAnnouncementDto {
  @ApiPropertyOptional({ description: 'Target audience type', enum: ANNOUNCEMENT_TARGET_TYPES, example: 'all' })
  @IsOptional()
  @IsIn(ANNOUNCEMENT_TARGET_TYPES)
  targetType?: (typeof ANNOUNCEMENT_TARGET_TYPES)[number];

  @ApiPropertyOptional({
    description: 'Target IDs (class IDs, grade levels, or user IDs depending on targetType)',
    example: ['c2d3e4f5-a6b7-4890-9bcd-ef0123456789'],
  })
  @IsOptional()
  @IsArray()
  targetIds?: string[];

  @ApiPropertyOptional({ description: 'Title', example: 'Mid-term exam schedule updated' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({ description: 'Content', example: 'The exam timetable has been revised — please re-check the portal.' })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({ description: 'Summary/preview', example: 'Updated mid-term exam timetable.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  summary?: string;

  @ApiPropertyOptional({ description: 'Priority', enum: ANNOUNCEMENT_PRIORITIES, example: 'urgent' })
  @IsOptional()
  @IsIn(ANNOUNCEMENT_PRIORITIES)
  priority?: (typeof ANNOUNCEMENT_PRIORITIES)[number];

  @ApiPropertyOptional({ description: 'Status', enum: ANNOUNCEMENT_STATUSES, example: 'archived' })
  @IsOptional()
  @IsIn(ANNOUNCEMENT_STATUSES)
  status?: (typeof ANNOUNCEMENT_STATUSES)[number];

  @ApiPropertyOptional({ description: 'Publish at', example: '2025-03-16T08:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  publishAt?: string;

  @ApiPropertyOptional({ description: 'Expires at', example: '2025-04-16T08:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional({ description: 'Attachments JSON array', example: [{ name: 'timetable-v2.pdf', url: 'https://files.example.com/timetable-v2.pdf' }] })
  @IsOptional()
  attachments?: any;

  @ApiPropertyOptional({ description: 'Metadata JSON', example: { source: 'admin-portal', revision: 2 } })
  @IsOptional()
  metadata?: any;
}

export class ListAnnouncementsDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by status', enum: ANNOUNCEMENT_STATUSES, example: 'published' })
  @IsOptional()
  @IsIn(ANNOUNCEMENT_STATUSES)
  status?: (typeof ANNOUNCEMENT_STATUSES)[number];

  @ApiPropertyOptional({ description: 'Filter by priority', enum: ANNOUNCEMENT_PRIORITIES, example: 'urgent' })
  @IsOptional()
  @IsIn(ANNOUNCEMENT_PRIORITIES)
  priority?: (typeof ANNOUNCEMENT_PRIORITIES)[number];

  @ApiPropertyOptional({ description: 'Filter by targetType', enum: ANNOUNCEMENT_TARGET_TYPES, example: 'parents' })
  @IsOptional()
  @IsIn(ANNOUNCEMENT_TARGET_TYPES)
  targetType?: (typeof ANNOUNCEMENT_TARGET_TYPES)[number];
}

export class CreateMessageDto {
  @ApiPropertyOptional({ description: 'Optional subject', example: 'Re: Term project deadline' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  subject?: string;

  @ApiProperty({ description: 'Content', example: 'Hi, just confirming the project is due next Friday. Thanks!' })
  @IsString()
  content: string;

  @ApiPropertyOptional({ description: 'Content type', enum: MESSAGE_CONTENT_TYPES, example: 'text' })
  @IsOptional()
  @IsIn(MESSAGE_CONTENT_TYPES)
  contentType?: (typeof MESSAGE_CONTENT_TYPES)[number] = 'text';

  @ApiProperty({ description: 'Recipient userTenant IDs', example: ['d57a414c-9991-4181-b6b2-929f4d2137aa'] })
  @IsArray()
  recipientIds: string[];

  @ApiPropertyOptional({ description: 'Thread ID (parent message id for reply)', example: 'b6c7d8e9-f0a1-4234-9bcd-ef0123456789' })
  @IsOptional()
  @IsString()
  threadId?: string;

  @ApiPropertyOptional({ description: 'Attachments JSON array', example: [{ name: 'project-brief.pdf', url: 'https://files.example.com/project-brief.pdf' }] })
  @IsOptional()
  attachments?: any;

  @ApiPropertyOptional({ description: 'Metadata JSON', example: { clientId: 'web' } })
  @IsOptional()
  metadata?: any;
}

export class MarkMessageReadDto {
  @ApiProperty({ description: 'Message ID', example: 'b6c7d8e9-f0a1-4234-9bcd-ef0123456789' })
  @IsString()
  messageId: string;
}

export class ListMessagesDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by status', enum: MESSAGE_STATUSES, example: 'delivered' })
  @IsOptional()
  @IsIn(MESSAGE_STATUSES)
  status?: (typeof MESSAGE_STATUSES)[number];
}
