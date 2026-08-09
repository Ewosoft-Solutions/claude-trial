import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import type { PaginationSortOrder } from '@workspace/api';

/** Filters for the cross-tenant audit log query. All optional; all narrowing. */
export class PlatformAuditQueryDto {
  @ApiPropertyOptional({ description: 'Restrict to one tenant.' })
  @IsOptional()
  @IsString()
  tenantId?: string;

  @ApiPropertyOptional({ example: 'platform_cross_tenant_access' })
  @IsOptional()
  @IsString()
  action?: string;

  @ApiPropertyOptional({ example: 'security_event' })
  @IsOptional()
  @IsString()
  eventType?: string;

  @ApiPropertyOptional({ description: 'Global user id of the actor.' })
  @IsOptional()
  @IsString()
  actorId?: string;

  @ApiPropertyOptional({ example: 'tenant' })
  @IsOptional()
  @IsString()
  resource?: string;

  @ApiPropertyOptional({
    description:
      'Free-text search across action, resource, description, actor role and tenant name.',
    example: 'login',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: '2026-07-01' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-07-31' })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Sort field (allow-listed).',
    enum: ['timestamp', 'action', 'eventType', 'resource'],
  })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: PaginationSortOrder;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsString()
  page?: string;

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @IsString()
  limit?: string;
}
