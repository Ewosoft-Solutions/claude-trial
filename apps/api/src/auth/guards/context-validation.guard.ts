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
import { PermissionService } from '../services/permission.service';
import { DatabaseService } from '../../common';
import { RequestUser } from '../types/request-user';

/**
 * Context Validation Guard
 *
 * Ensures user belongs to school and profile is active.
 */
@Injectable()
export class ContextValidationGuard implements CanActivate {
  constructor(
    private readonly permissionService: PermissionService,
    private readonly dbService: DatabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = (request as unknown as { user?: RequestUser }).user;

    if (!user?.userId || !user.tenantId || !user.profileId) {
      throw new ForbiddenException('User context not found');
    }

    const prisma = this.dbService.client;

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
