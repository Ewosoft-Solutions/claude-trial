/**
 * Multi-Layer Security Validation Middleware
 *
 * Implements comprehensive security validation:
 * 1. JWT validation (already done by JwtAuthGuard)
 * 2. Tenant context validation
 * 3. Context validation (user belongs to school, profile active)
 * 4. Clearance level validation
 * 5. Permission validation
 *
 * Implements item 4.11.
 */

import {
  Injectable,
  NestMiddleware,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PermissionService, UserPermissionContext } from '../services/permission.service';
import { RequestUser } from '../types/request-user';

import { DatabaseService } from '../../common';

/**
 * Extended Request with user context
 */
export interface AuthenticatedRequest extends Request {
  user?: RequestUser;
  userContext?: UserPermissionContext;
}

/**
 * Multi-Layer Security Validation Middleware
 *
 * Performs comprehensive security validation on every request.
 */
@Injectable()
export class MultiLayerSecurityMiddleware implements NestMiddleware {
  constructor(
    private readonly permissionService: PermissionService,
    private readonly dbService: DatabaseService,
  ) {}

  async use(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    // Skip if no user context (public endpoints)
    if (!req.user) {
      return next();
    }

    const { userId, tenantId, profileId } = req.user;

    if (!userId || !tenantId || !profileId) {
      throw new UnauthorizedException('User context incomplete');
    }

    const prisma = this.dbService.client;

    // Layer 1: Validate strict context (user belongs to school, profile active)
    const contextValidation =
      await this.permissionService.validateStrictContext(
        prisma,
        userId,
        tenantId,
        profileId,
      );

    if (!contextValidation.valid) {
      throw new ForbiddenException(
        contextValidation.error || 'Context validation failed',
      );
    }

    // Layer 2: Load user permission context
    const userContext = await this.permissionService.getUserPermissionContext(
      prisma,
      userId,
      tenantId,
      profileId,
    );

    if (!userContext) {
      throw new ForbiddenException('User profile not found or inactive');
    }

    // Attach user context to request for use in guards and handlers
    req.userContext = userContext;

    // Note: Clearance level and permission checks are done by specific guards
    // This middleware ensures the context is loaded and validated

    next();
  }
}
