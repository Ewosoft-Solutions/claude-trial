import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { Observable, from, lastValueFrom } from 'rxjs';
import { TenantDbService } from './tenant-db.service';
import type { RequestUser } from '../../auth/types/request-user';

/**
 * Marks a controller/handler as tenant-scoped: its work runs inside an RLS
 * transaction (`app.current_tenant_id` set) on the `app_runtime` client, so its
 * services must read/write through `TenantDbService.client`. Runs AFTER the auth
 * guards, so `request.user.tenantId` is available.
 */
export const TENANT_SCOPED_KEY = 'rls:tenant_scoped';
export const TenantScoped = () => SetMetadata(TENANT_SCOPED_KEY, true);

/**
 * Opens the per-request RLS scope for `@TenantScoped` handlers. Passes through
 * unchanged for non-scoped handlers or unauthenticated requests (those use the
 * privileged client — e.g. auth/platform paths).
 */
@Injectable()
export class RlsTenantInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly tenantDb: TenantDbService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const scoped = this.reflector.getAllAndOverride<boolean>(
      TENANT_SCOPED_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!scoped) return next.handle();

    const req = context.switchToHttp().getRequest<Request & { user?: RequestUser }>();
    const tenantId = req.user?.tenantId;
    if (!tenantId) return next.handle();

    // Run the handler inside the tenant RLS scope. lastValueFrom resolves the
    // handler's observable to a promise so it executes within runScoped's tx.
    return from(
      this.tenantDb.runScoped(tenantId, req.user?.userId, () =>
        lastValueFrom(next.handle()),
      ),
    );
  }
}
