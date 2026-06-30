import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { PaginationSortOrder } from '@workspace/api';

/**
 * Base DTO
 *
 * Base class for all DTOs with common properties and validation patterns.
 */
export abstract class BaseDto {
  @ApiPropertyOptional({ description: 'Record ID', example: 'a1b2c3d4-e5f6-4789-9abc-def012345678' })
  id?: string;

  @ApiPropertyOptional({ description: 'Created at timestamp', example: '2025-03-01T09:00:00.000Z' })
  createdAt?: Date;

  @ApiPropertyOptional({ description: 'Updated at timestamp', example: '2025-03-10T14:30:00.000Z' })
  updatedAt?: Date;
}

/**
 * Pagination DTO
 *
 * Common pagination parameters for list endpoints.
 */
export class PaginationDto {
  @ApiPropertyOptional({
    description: 'Page number (1-based)',
    default: 1,
    minimum: 1,
    example: 1,
  })
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    default: 10,
    minimum: 1,
    maximum: 100,
    example: 10,
  })
  limit?: number = 10;

  @ApiPropertyOptional({ description: 'Sort field', example: 'createdAt' })
  sortBy?: string;

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: ['asc', 'desc'],
    default: 'asc',
    example: 'asc',
  })
  sortOrder?: PaginationSortOrder = 'asc';
}

/**
 * Paginated Response DTO
 *
 * Standard response format for paginated endpoints.
 */
export class PaginatedResponseDto<T> {
  @ApiProperty({ description: 'Array of items' })
  data: T[];

  @ApiProperty({ description: 'Total number of items', example: 42 })
  total: number;

  @ApiProperty({ description: 'Current page number', example: 1 })
  page: number;

  @ApiProperty({ description: 'Number of items per page', example: 10 })
  limit: number;

  @ApiProperty({ description: 'Total number of pages', example: 5 })
  totalPages: number;

  @ApiProperty({ description: 'Whether there is a next page', example: true })
  hasNext: boolean;

  @ApiProperty({ description: 'Whether there is a previous page', example: false })
  hasPrev: boolean;
}
