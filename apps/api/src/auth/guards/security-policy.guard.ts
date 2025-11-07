/**
 * Security Policy Guard
 *
 * Validates requests against school security policies:
 * - MFA requirements for sensitive operations
 * - IP whitelist restrictions
 * - Time restrictions
 * - VPN requirements
 *
 * Implements item 4a.5
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaClient } from '@workspace/database';
import { SecurityPolicyService } from '../services/security-policy.service';
import { AuthenticatedRequest } from '../middleware/multi-layer-security.middleware';

@Injectable()
export class SecurityPolicyGuard implements CanActivate {
  constructor(
    private readonly securityPolicyService: SecurityPolicyService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    // Skip if no user context (public endpoints)
    if (!request.user) {
      return true;
    }

    const { tenantId } = request.user;

    if (!tenantId) {
      throw new ForbiddenException('Tenant context required');
    }

    // Get Prisma client from request
    const prisma: PrismaClient = request.prisma || (global as any).prisma;

    if (!prisma) {
      throw new ForbiddenException('Database connection not available');
    }

    // Get school security policy
    const policy = await this.securityPolicyService.getOrCreateDefaultPolicy(
      prisma,
      tenantId,
    );

    // Get operation from request (route path or method)
    const operation = this.getOperation(request);

    // Get client IP address
    const ipAddress =
      request.ip ||
      request.headers['x-forwarded-for']?.toString().split(',')[0] ||
      request.connection.remoteAddress;

    // Validate policy compliance
    const validation = this.securityPolicyService.validatePolicyCompliance(
      policy,
      operation,
      ipAddress,
      new Date(),
    );

    if (!validation.compliant) {
      throw new ForbiddenException(
        `Security policy violation: ${validation.errors.join(', ')}`,
      );
    }

    // Check MFA requirements for sensitive operations
    if (
      policy.requireMFAForSensitiveOperations &&
      policy.sensitiveOperations.includes(operation)
    ) {
      // MFA validation is done by MFARequiredGuard
      // This guard just ensures the policy requires MFA
      // The actual MFA check happens in the MFA guard
    }

    // Attach policy to request for use in handlers
    (request as any).securityPolicy = policy;

    return true;
  }

  /**
   * Extract operation name from request
   */
  private getOperation(request: AuthenticatedRequest): string {
    // Use route path as operation identifier
    const path = request.route?.path || request.path;
    const method = request.method.toLowerCase();

    // Normalize operation name
    return `${method}:${path}`.replace(/\/+/g, '/').replace(/^\/|\/$/g, '');
  }
}


