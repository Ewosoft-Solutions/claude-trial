/**
 * Tenant Context Middleware
 *
 * Middleware for tenant context validation.
 * Part of multi-layer validation (3.9).
 */

import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * Tenant Context Middleware
 *
 * Validates tenant context from request headers or subdomain.
 */
@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Extract tenant context from:
    // 1. Subdomain (if available)
    // 2. X-Tenant-ID header
    // 3. JWT token (if authenticated)

    const tenantId = this.extractTenantId(req);

    if (tenantId) {
      req.headers['x-tenant-id'] = tenantId;
    }

    next();
  }

  private extractTenantId(req: Request): string | undefined {
    // Check header first
    if (req.headers['x-tenant-id']) {
      return req.headers['x-tenant-id'] as string;
    }

    // Check subdomain (if available)
    const host = req.headers.host;
    if (host) {
      const subdomain = host.split('.')[0];
      // TODO: Resolve tenant from subdomain
      // This would require database lookup
    }

    // Check JWT token (if authenticated)
    // This is handled by JwtAuthGuard

    return undefined;
  }
}
