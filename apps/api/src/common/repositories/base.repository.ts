import { PrismaClient } from '@workspace/database';
import { Injectable } from '@nestjs/common';

/**
 * Base Repository
 *
 * Abstract base class for all repositories providing common CRUD operations
 * and database access patterns.
 */
@Injectable()
export abstract class BaseRepository<T> {
  constructor(protected readonly prisma: PrismaClient) {}

  /**
   * Find a single record by ID
   */
  abstract findById(id: string, tenantId?: string): Promise<T | null>;

  /**
   * Find multiple records with optional filters
   */
  abstract findMany(filters?: any, tenantId?: string): Promise<T[]>;

  /**
   * Create a new record
   */
  abstract create(data: any, tenantId?: string): Promise<T>;

  /**
   * Update a record by ID
   */
  abstract update(id: string, data: any, tenantId?: string): Promise<T>;

  /**
   * Delete a record by ID
   */
  abstract delete(id: string, tenantId?: string): Promise<T>;

  /**
   * Count records with optional filters
   */
  abstract count(filters?: any, tenantId?: string): Promise<number>;
}
