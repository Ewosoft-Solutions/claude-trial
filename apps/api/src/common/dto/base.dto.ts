import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Base DTO
 *
 * Base class for all DTOs with common properties and validation patterns.
 */
export abstract class BaseDto {
  @ApiPropertyOptional({ description: 'Record ID' })
  id?: string;

  @ApiPropertyOptional({ description: 'Created at timestamp' })
  createdAt?: Date;

  @ApiPropertyOptional({ description: 'Updated at timestamp' })
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
  })
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    default: 10,
    minimum: 1,
    maximum: 100,
  })
  limit?: number = 10;

  @ApiPropertyOptional({ description: 'Sort field' })
  sortBy?: string;

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: ['asc', 'desc'],
    default: 'asc',
  })
  sortOrder?: 'asc' | 'desc' = 'asc';
}

/**
 * Paginated Response DTO
 *
 * Standard response format for paginated endpoints.
 */
export class PaginatedResponseDto<T> {
  @ApiProperty({ description: 'Array of items' })
  data: T[];

  @ApiProperty({ description: 'Total number of items' })
  total: number;

  @ApiProperty({ description: 'Current page number' })
  page: number;

  @ApiProperty({ description: 'Number of items per page' })
  limit: number;

  @ApiProperty({ description: 'Total number of pages' })
  totalPages: number;

  @ApiProperty({ description: 'Whether there is a next page' })
  hasNext: boolean;

  @ApiProperty({ description: 'Whether there is a previous page' })
  hasPrev: boolean;
}
