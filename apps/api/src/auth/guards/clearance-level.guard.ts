/**
 * Clearance Level Guard
 *
 * Validates user's clearance level meets the required level.
 * Implements item 4.4.
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaClient } from '@workspace/database';
import { PermissionService } from '../services/permission.service';

/**
 * Metadata key for clearance level requirement
 */
export const CLEARANCE_LEVEL_KEY = 'clearance_level';

/**
 * Decorator to require a minimum clearance level
 *
 * @param level - Required clearance level (0-10)
 * @returns Decorator
 */
export const RequireClearanceLevel = (level: number) =>
  SetMetadata(CLEARANCE_LEVEL_KEY, level);

/**
 * Clearance Level Guard
 *
 * Validates that user's clearance level meets the required level.
 */
@Injectable()
export class ClearanceLevelGuard implements CanActivate {
  constructor(
    private readonly permissionService: PermissionService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredLevel = this.reflector.getAllAndOverride<number>(
      CLEARANCE_LEVEL_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no clearance level requirement, allow access
    if (requiredLevel === undefined) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.userId || !user.tenantId || !user.profileId) {
      throw new ForbiddenException('User context not found');
    }

    // Get Prisma client from request
    const prisma: PrismaClient = request.prisma || (global as any).prisma;

    if (!prisma) {
      throw new ForbiddenException('Database connection not available');
    }

    // Get user permission context
    const userContext = await this.permissionService.getUserPermissionContext(
      prisma,
      user.userId,
      user.tenantId,
      user.profileId,
    );

    if (!userContext) {
      throw new ForbiddenException('User profile not found or inactive');
    }

    // Check clearance level
    const check = this.permissionService.checkClearanceLevel(
      userContext,
      requiredLevel,
    );

    if (!check.granted) {
      throw new ForbiddenException(
        `Insufficient clearance level. Required: ${requiredLevel}, Current: ${check.clearanceLevel}`,
      );
    }

    // Attach user context to request for use in handlers
    request.userContext = userContext;

    return true;
  }
}
