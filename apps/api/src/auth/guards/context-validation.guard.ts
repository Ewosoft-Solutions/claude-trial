/**
 * Context Validation Guard
 *
 * Validates strict context: user belongs to school, profile is active.
 * Implements item 4.10.
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaClient } from '@workspace/database';
import { PermissionService } from '../services/permission.service';

/**
 * Context Validation Guard
 *
 * Ensures user belongs to school and profile is active.
 */
@Injectable()
export class ContextValidationGuard implements CanActivate {
  constructor(private readonly permissionService: PermissionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
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

    // Validate strict context
    const validation = await this.permissionService.validateStrictContext(
      prisma,
      user.userId,
      user.tenantId,
      user.profileId,
    );

    if (!validation.valid) {
      throw new ForbiddenException(
        validation.error || 'Context validation failed',
      );
    }

    return true;
  }
}
