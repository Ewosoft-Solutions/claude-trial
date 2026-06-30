/**
 * AI Mediator DTOs
 *
 * Data transfer objects for AI mediator queries and responses.
 * Used for AI mediator integration (4b.1-4b.5).
 */

import {
  IsString,
  IsOptional,
  IsEnum,
  IsObject,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AccessScope, AIQueryType } from '@workspace/api';

/**
 * AI Query Request DTO
 */
export class AIQueryRequestDto {
  @ApiProperty({
    description: 'The AI query/question',
    example: 'What is the average performance of grade 4 students this term?',
    maxLength: 5000,
  })
  @IsString()
  @MaxLength(5000)
  query: string;

  @ApiPropertyOptional({
    description: 'Query type (academic, analytics, or general)',
    enum: AIQueryType,
    default: AIQueryType.GENERAL,
    example: AIQueryType.ACADEMIC,
  })
  @IsOptional()
  @IsEnum(AIQueryType)
  queryType?: AIQueryType;

  @ApiPropertyOptional({
    description: 'Additional context for the query',
    type: Object,
    example: { lessonId: 'lesson-123', classId: 'class-456' },
  })
  @IsOptional()
  @IsObject()
  context?: Record<string, any>;
}

/**
 * AI Query Validation Response DTO
 */
export class AIQueryValidationResponseDto {
  @ApiProperty({
    description: 'Whether the query is allowed',
    example: true,
  })
  allowed: boolean;

  @ApiPropertyOptional({
    description: 'Reason if query is not allowed',
    example: 'Insufficient clearance level',
  })
  reason?: string;

  @ApiPropertyOptional({
    description: 'Required clearance level',
    example: 7,
  })
  requiredClearanceLevel?: number;

  @ApiPropertyOptional({
    description: 'User clearance level',
    example: 5,
  })
  userClearanceLevel?: number;

  @ApiPropertyOptional({
    description: 'Required access scope',
    enum: AccessScope,
  })
  requiredAccessScope?: AccessScope;

  @ApiPropertyOptional({
    description: 'User access scope',
    enum: AccessScope,
  })
  userAccessScope?: AccessScope;
}

/**
 * AI Mediator Context Response DTO
 */
export class AIMediatorContextResponseDto {
  @ApiProperty({
    description: 'User ID',
    example: 'user-123',
  })
  userId: string;

  @ApiProperty({
    description: 'Tenant ID',
    example: 'tenant-456',
  })
  tenantId: string;

  @ApiProperty({
    description: 'Profile ID',
    example: 'profile-789',
  })
  profileId: string;

  @ApiProperty({
    description: 'Clearance level (0-10)',
    example: 7,
  })
  clearanceLevel: number;

  @ApiProperty({
    description: 'Role IDs',
    example: ['role-1', 'role-2'],
  })
  roleIds: string[];

  @ApiProperty({
    description: 'Role names',
    example: ['Teacher', 'Class Coordinator'],
  })
  roles: string[];

  @ApiProperty({
    description: 'Granted permissions',
    example: ['student:read', 'grade:read'],
  })
  permissions: string[];

  @ApiProperty({
    description: 'Permission pool names',
    example: ['Level7_SchoolManagement', 'Level3_Teacher'],
  })
  permissionPools: string[];

  @ApiProperty({
    description: 'Access scope',
    enum: AccessScope,
  })
  accessScope: AccessScope;
}

/**
 * AI Query Response DTO
 */
export class AIQueryResponseDto {
  @ApiProperty({
    description: 'AI mediator context',
    type: AIMediatorContextResponseDto,
  })
  context: AIMediatorContextResponseDto;

  @ApiProperty({
    description: 'Query validation result',
    type: AIQueryValidationResponseDto,
  })
  validation: AIQueryValidationResponseDto;

  @ApiPropertyOptional({
    description: 'Filtered data (if applicable)',
    type: 'array',
  })
  filteredData?: any[];
}
