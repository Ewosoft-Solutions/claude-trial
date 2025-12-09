/**
 * Tenant Context Guard
 *
 * Validates tenant context and ensures user has access to the tenant.
 * Part of multi-layer validation (3.9).
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { TenantValidationService } from '@workspace/api';
import { DatabaseService } from '../../common';

/**
 * Tenant Context Guard
 *
 * Validates that user has access to the tenant from the request context.
 */
@Injectable()
export class TenantContextGuard implements CanActivate {
  constructor(private readonly dbService: DatabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.userId || !user.tenantId) {
      throw new UnauthorizedException('User context not found');
    }

    const prisma = this.dbService.client;

    // Validate user has access to tenant
    const validation = await TenantValidationService.validateUserAccess(
      prisma,
      user.userId,
      user.tenantId,
    );

    if (!validation.valid) {
      throw new ForbiddenException(
        validation.error || 'Access denied to this tenant',
      );
    }

    // Attach full tenant context to request
    // This could be enhanced to load full context from database
    request.tenantContext = {
      tenantId: user.tenantId,
      userId: user.userId,
      profileId: user.profileId,
      roles: user.roles,
    };

    return true;
  }
}
