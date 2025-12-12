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
  @ApiProperty({ description: 'Target audience type', enum: ANNOUNCEMENT_TARGET_TYPES })
  @IsString()
  @IsIn(ANNOUNCEMENT_TARGET_TYPES)
  targetType: (typeof ANNOUNCEMENT_TARGET_TYPES)[number];

  @ApiPropertyOptional({
    description: 'Target IDs (class IDs, grade levels, or user IDs depending on targetType)',
  })
  @IsOptional()
  @IsArray()
  targetIds?: string[];

  @ApiProperty({ description: 'Title' })
  @IsString()
  @MaxLength(255)
  title: string;

  @ApiProperty({ description: 'Content' })
  @IsString()
  content: string;

  @ApiPropertyOptional({ description: 'Summary/preview' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  summary?: string;

  @ApiPropertyOptional({ description: 'Priority', enum: ANNOUNCEMENT_PRIORITIES })
  @IsOptional()
  @IsIn(ANNOUNCEMENT_PRIORITIES)
  priority?: (typeof ANNOUNCEMENT_PRIORITIES)[number];

  @ApiPropertyOptional({ description: 'Status', enum: ANNOUNCEMENT_STATUSES, default: 'draft' })
  @IsOptional()
  @IsIn(ANNOUNCEMENT_STATUSES)
  status?: (typeof ANNOUNCEMENT_STATUSES)[number] = 'draft';

  @ApiPropertyOptional({ description: 'Publish at (schedule)' })
  @IsOptional()
  @IsDateString()
  publishAt?: string;

  @ApiPropertyOptional({ description: 'Expires at' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional({ description: 'Attachments JSON array' })
  @IsOptional()
  attachments?: any;

  @ApiPropertyOptional({ description: 'Metadata JSON' })
  @IsOptional()
  metadata?: any;
}

export class UpdateAnnouncementDto {
  @ApiPropertyOptional({ description: 'Target audience type', enum: ANNOUNCEMENT_TARGET_TYPES })
  @IsOptional()
  @IsIn(ANNOUNCEMENT_TARGET_TYPES)
  targetType?: (typeof ANNOUNCEMENT_TARGET_TYPES)[number];

  @ApiPropertyOptional({
    description: 'Target IDs (class IDs, grade levels, or user IDs depending on targetType)',
  })
  @IsOptional()
  @IsArray()
  targetIds?: string[];

  @ApiPropertyOptional({ description: 'Title' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({ description: 'Content' })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({ description: 'Summary/preview' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  summary?: string;

  @ApiPropertyOptional({ description: 'Priority', enum: ANNOUNCEMENT_PRIORITIES })
  @IsOptional()
  @IsIn(ANNOUNCEMENT_PRIORITIES)
  priority?: (typeof ANNOUNCEMENT_PRIORITIES)[number];

  @ApiPropertyOptional({ description: 'Status', enum: ANNOUNCEMENT_STATUSES })
  @IsOptional()
  @IsIn(ANNOUNCEMENT_STATUSES)
  status?: (typeof ANNOUNCEMENT_STATUSES)[number];

  @ApiPropertyOptional({ description: 'Publish at' })
  @IsOptional()
  @IsDateString()
  publishAt?: string;

  @ApiPropertyOptional({ description: 'Expires at' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional({ description: 'Attachments JSON array' })
  @IsOptional()
  attachments?: any;

  @ApiPropertyOptional({ description: 'Metadata JSON' })
  @IsOptional()
  metadata?: any;
}

export class ListAnnouncementsDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by status', enum: ANNOUNCEMENT_STATUSES })
  @IsOptional()
  @IsIn(ANNOUNCEMENT_STATUSES)
  status?: (typeof ANNOUNCEMENT_STATUSES)[number];

  @ApiPropertyOptional({ description: 'Filter by priority', enum: ANNOUNCEMENT_PRIORITIES })
  @IsOptional()
  @IsIn(ANNOUNCEMENT_PRIORITIES)
  priority?: (typeof ANNOUNCEMENT_PRIORITIES)[number];

  @ApiPropertyOptional({ description: 'Filter by targetType', enum: ANNOUNCEMENT_TARGET_TYPES })
  @IsOptional()
  @IsIn(ANNOUNCEMENT_TARGET_TYPES)
  targetType?: (typeof ANNOUNCEMENT_TARGET_TYPES)[number];
}

export class CreateMessageDto {
  @ApiPropertyOptional({ description: 'Optional subject' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  subject?: string;

  @ApiProperty({ description: 'Content' })
  @IsString()
  content: string;

  @ApiPropertyOptional({ description: 'Content type', enum: MESSAGE_CONTENT_TYPES })
  @IsOptional()
  @IsIn(MESSAGE_CONTENT_TYPES)
  contentType?: (typeof MESSAGE_CONTENT_TYPES)[number] = 'text';

  @ApiProperty({ description: 'Recipient userTenant IDs' })
  @IsArray()
  recipientIds: string[];

  @ApiPropertyOptional({ description: 'Thread ID (parent message id for reply)' })
  @IsOptional()
  @IsString()
  threadId?: string;

  @ApiPropertyOptional({ description: 'Attachments JSON array' })
  @IsOptional()
  attachments?: any;

  @ApiPropertyOptional({ description: 'Metadata JSON' })
  @IsOptional()
  metadata?: any;
}

export class MarkMessageReadDto {
  @ApiProperty({ description: 'Message ID' })
  @IsString()
  messageId: string;
}

export class ListMessagesDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by status', enum: MESSAGE_STATUSES })
  @IsOptional()
  @IsIn(MESSAGE_STATUSES)
  status?: (typeof MESSAGE_STATUSES)[number];
}

