import {
  CallHandler,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { Observable, from, lastValueFrom } from 'rxjs';
import { ClearanceLevelHelpers } from '@workspace/api';
import { TenantDbService } from './tenant-db.service';
import { DatabaseService } from './database.service';
import { PlatformAuditService } from '../audit/platform-audit.service';
import {
  PermissionService,
  type UserPermissionContext,
} from '../../auth/services/permission.service';
import type { RequestUser } from '../../auth/types/request-user';

/**
 * Metadata key for platform-scoped handlers. The value is the list of
 * `platform.*` permissions that may authorize the handler (ANY-of).
 *
 * Declared here rather than alongside the decorator so that this interceptor
 * has no import edge into `auth/guards` — see `platform-scoped.decorator.ts`.
 */
export const PLATFORM_SCOPED_KEY = 'rls:platform_scoped';

/** Header/`req` shape this interceptor relies on downstream guards to populate. */
type PlatformRequest = Request & {
  user?: RequestUser;
  userContext?: UserPermissionContext;
};

/**
 * Opens the audited cross-tenant RLS scope (`app.is_platform='on'`) for
 * `@PlatformScoped()` handlers, and records every entry into it.
 *
 * This is the ONLY sanctioned way to read across tenants (ADR-004).
 *
 * It performs the permission check itself rather than delegating to
 * `PermissionGuard`, for one specific reason: Nest runs guards *before*
 * interceptors, so a guard denial would return 403 without ever reaching this
 * code — and refused cross-tenant attempts are exactly what a platform audit
 * trail most needs to record. Owning the check keeps grant and denial on the
 * same path. The check itself is the same `PermissionService` logic the guard
 * uses, so this is a relocation of the check, not a weakening of it.
 */
@Injectable()
export class RlsPlatformInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RlsPlatformInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly tenantDb: TenantDbService,
    private readonly dbService: DatabaseService,
    private readonly permissionService: PermissionService,
    private readonly platformAudit: PlatformAuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const permissions = this.reflector.getAllAndOverride<string[]>(
      PLATFORM_SCOPED_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!permissions?.length) return next.handle();

    return from(this.runPlatformScoped(context, next, permissions));
  }

  private async runPlatformScoped(
    context: ExecutionContext,
    next: CallHandler,
    permissions: string[],
  ): Promise<unknown> {
    const req = context.switchToHttp().getRequest<PlatformRequest>();
    const user = req.user;
    const userContext = req.userContext;

    const method = req.method;
    const path = req.originalUrl ?? req.url;
    const ipAddress = req.ip ?? null;
    const userAgent = req.get?.('user-agent') ?? null;

    // A tenant id on a path param is the usual "this request is about one
    // specific tenant" signal; recorded so an auditor can answer "who looked
    // at school X" without replaying request logs.
    const params = req.params as Record<string, string> | undefined;
    const targetTenantId = params?.tenantId ?? params?.id;

    const deny = async (reason: string): Promise<never> => {
      await this.platformAudit.logCrossTenantAccess({
        userId: user?.userId ?? 'unknown',
        tenantId: user?.tenantId ?? 'unknown',
        permissions,
        method,
        path,
        granted: false,
        targetTenantId,
        failureReason: reason,
        ipAddress,
        userAgent,
      });
      this.logger.warn(
        `Refused platform scope for ${method} ${path}: ${reason}`,
      );
      throw new ForbiddenException(
        'You do not have permission to perform this action',
      );
    };

    if (!user?.userId || !user.tenantId || !user.profileId) {
      return deny('unauthenticated request on a platform-scoped handler');
    }

    // Reuse the context an earlier guard resolved; otherwise resolve it here.
    const resolved =
      userContext ??
      (await this.permissionService.getUserPermissionContext(
        this.dbService.client,
        user.userId,
        user.tenantId,
        user.profileId,
      ));

    if (!resolved) {
      return deny('user profile not found or inactive');
    }
    req.userContext = resolved;

    if (!ClearanceLevelHelpers.isSuperAdminOrHigher(resolved.clearanceLevel)) {
      return deny(
        `clearance ${resolved.clearanceLevel} is below the platform minimum`,
      );
    }

    const check = this.permissionService.checkAnyPermission(
      resolved,
      permissions,
    );
    if (!check.granted) {
      return deny(check.reason ?? 'permission check failed');
    }

    await this.platformAudit.logCrossTenantAccess({
      userId: user.userId,
      tenantId: user.tenantId,
      permissions,
      method,
      path,
      granted: true,
      targetTenantId,
      ipAddress,
      userAgent,
    });

    // Keep this transaction short and single-purpose: `app.is_platform='on'`
    // lifts tenant isolation on every table for its duration, so it must never
    // wrap slow or externally-dependent work (e.g. an LLM round-trip).
    return this.tenantDb.runPlatform(user.userId, () =>
      lastValueFrom(next.handle()),
    );
  }
}
