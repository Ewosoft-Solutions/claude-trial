/**
 * Permission Guard
 *
 * Validates user has required permissions.
 * Implements item 4.5, 4.6.
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionService } from '../services/permission.service';
import { PermissionMode } from '@workspace/api';
import { DatabaseService } from '../../common';
/**
 * Metadata key for permission requirement
 */
export const PERMISSIONS_KEY = 'permissions';
export const PERMISSION_MODE_KEY = 'permission_mode';
export const REQUIRED_CLEARANCE_KEY = 'required_clearance';

/**
 * Decorator to require specific permissions
 *
 * @param permissions - Array of permission names
 * @param mode - Check mode (ALL or ANY, default: ALL)
 * @param requiredClearanceLevel - Optional required clearance level
 * @returns Decorator
 */
export const RequirePermissions = (
  permissions: string[],
  mode: PermissionMode = PermissionMode.ALL,
  requiredClearanceLevel?: number,
) => {
  return (target: any, key?: string, descriptor?: PropertyDescriptor) => {
    SetMetadata(PERMISSIONS_KEY, permissions)(target, key, descriptor);
    SetMetadata(PERMISSION_MODE_KEY, mode)(target, key, descriptor);
    if (requiredClearanceLevel !== undefined) {
      SetMetadata(REQUIRED_CLEARANCE_KEY, requiredClearanceLevel)(
        target,
        key,
        descriptor,
      );
    }
  };
};

/**
 * Permission Guard
 *
 * Validates that user has the required permissions.
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly permissionService: PermissionService,
    private readonly reflector: Reflector,
    private readonly db: DatabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const permissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no permission requirement, allow access
    if (!permissions || permissions.length === 0) {
      return true;
    }

    const mode =
      this.reflector.getAllAndOverride<PermissionMode>(PERMISSION_MODE_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) || PermissionMode.ALL;

    const requiredClearanceLevel = this.reflector.getAllAndOverride<number>(
      REQUIRED_CLEARANCE_KEY,
      [context.getHandler(), context.getClass()],
    );

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.userId || !user.tenantId || !user.profileId) {
      throw new ForbiddenException('User context not found');
    }

    const prisma = this.db.client;

    // Get user permission context (use cached if available)
    let userContext = request.userContext;
    if (!userContext) {
      userContext = await this.permissionService.getUserPermissionContext(
        prisma,
        user.userId,
        user.tenantId,
        user.profileId,
      );

      if (!userContext) {
        throw new ForbiddenException('User profile not found or inactive');
      }

      // Cache for use in handlers
      request.userContext = userContext;
    }

    // Check permissions based on mode
    let check;
    if (mode === PermissionMode.ANY) {
      check = this.permissionService.checkAnyPermission(
        userContext,
        permissions,
        requiredClearanceLevel,
      );
    } else {
      check = this.permissionService.checkPermissions(
        userContext,
        permissions,
        requiredClearanceLevel,
      );
    }

    if (!check.granted) {
      throw new ForbiddenException(check.reason || 'Insufficient permissions');
    }

    return true;
  }
}
