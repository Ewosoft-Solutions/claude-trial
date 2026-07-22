/**
 * RlsPlatformInterceptor — the gate on cross-tenant access.
 *
 * The behaviour that matters here is fail-closed: the audited `app.is_platform`
 * scope must open only for a request that a PermissionGuard has already
 * cleared, and every attempt — allowed or refused — must leave an audit row.
 */
import { ForbiddenException } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import { RlsPlatformInterceptor } from './rls-platform.interceptor';

const PERMS = ['platform.tenants.read'];

function build(opts: {
  scopedPermissions?: string[] | undefined;
  user?: { userId: string; tenantId: string; profileId: string } | undefined;
  clearanceLevel?: number | undefined;
  permissionGranted?: boolean;
  params?: Record<string, string>;
}) {
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(opts.scopedPermissions),
  };

  const runPlatform = jest.fn(
    (_userId: unknown, fn: () => unknown) => fn() as unknown,
  );
  const tenantDb = { runPlatform };

  const logCrossTenantAccess = jest.fn().mockResolvedValue(undefined);
  const platformAudit = { logCrossTenantAccess };

  const context_ =
    opts.clearanceLevel === undefined
      ? null
      : { clearanceLevel: opts.clearanceLevel };

  const dbService = { client: {} };
  const permissionService = {
    getUserPermissionContext: jest.fn().mockResolvedValue(context_),
    checkAnyPermission: jest
      .fn()
      .mockReturnValue(
        opts.permissionGranted === false
          ? { granted: false, reason: 'missing_permission: platform.tenants.read' }
          : { granted: true },
      ),
  };

  const req = {
    user: opts.user,
    // Left unset: the interceptor resolves its own context via PermissionService.
    userContext: undefined,
    method: 'GET',
    originalUrl: '/tenant',
    url: '/tenant',
    ip: '10.0.0.1',
    params: opts.params ?? {},
    get: () => 'jest',
  };

  const context = {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => req }),
  };

  const handled = jest.fn().mockReturnValue(of('handler-result'));
  const next = { handle: handled };

  const interceptor = new RlsPlatformInterceptor(
    reflector as never,
    tenantDb as never,
    dbService as never,
    permissionService as never,
    platformAudit as never,
  );

  return { interceptor, context, next, runPlatform, logCrossTenantAccess, handled };
}

describe('RlsPlatformInterceptor', () => {
  it('passes through handlers that are not platform-scoped', async () => {
    const { interceptor, context, next, runPlatform, logCrossTenantAccess } =
      build({ scopedPermissions: undefined });

    await expect(
      lastValueFrom(interceptor.intercept(context as never, next as never)),
    ).resolves.toBe('handler-result');

    // No scope widening and no audit noise on ordinary requests.
    expect(runPlatform).not.toHaveBeenCalled();
    expect(logCrossTenantAccess).not.toHaveBeenCalled();
  });

  it('opens the platform scope and audits when clearance is sufficient', async () => {
    const { interceptor, context, next, runPlatform, logCrossTenantAccess } =
      build({
        scopedPermissions: PERMS,
        user: { userId: 'u1', tenantId: 'platform-tenant', profileId: 'p1' },
        clearanceLevel: 9,
        params: { id: 'target-tenant' },
      });

    await expect(
      lastValueFrom(interceptor.intercept(context as never, next as never)),
    ).resolves.toBe('handler-result');

    expect(runPlatform).toHaveBeenCalledTimes(1);
    expect(runPlatform.mock.calls[0]?.[0]).toBe('u1');
    expect(logCrossTenantAccess).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u1',
        granted: true,
        permissions: PERMS,
        // The path param is captured so "who looked at school X" is answerable.
        targetTenantId: 'target-tenant',
      }),
    );
  });

  it('refuses when the profile cannot be resolved', async () => {
    const { interceptor, context, next, runPlatform, logCrossTenantAccess } =
      build({
        scopedPermissions: PERMS,
        user: { userId: 'u1', tenantId: 'platform-tenant', profileId: 'p1' },
        clearanceLevel: undefined, // getUserPermissionContext resolves to null
      });

    await expect(
      lastValueFrom(interceptor.intercept(context as never, next as never)),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(runPlatform).not.toHaveBeenCalled();
    expect(logCrossTenantAccess).toHaveBeenCalledWith(
      expect.objectContaining({ granted: false }),
    );
  });

  it('refuses school-level clearance and records the denial', async () => {
    const { interceptor, context, next, runPlatform, logCrossTenantAccess } =
      build({
        scopedPermissions: PERMS,
        user: { userId: 'owner', tenantId: 'school-a' },
        clearanceLevel: 8, // Owner — the highest school role, still not platform
      });

    await expect(
      lastValueFrom(interceptor.intercept(context as never, next as never)),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(runPlatform).not.toHaveBeenCalled();
    expect(logCrossTenantAccess).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'owner', granted: false }),
    );
  });

  it('audits the denial when clearance is high enough but the permission is missing', async () => {
    // The live shape of this: a seeded SuperAdmin (clearance 9) holds the
    // level-9 facets (`platform.tenants.read`/`.act`) but not the level-10 ones
    // (`platform.tenants.inspect`, `platform.metrics`), so reaching for a
    // level-10 facet is denied. The denial must still reach the audit trail —
    // that is why this check lives in the interceptor, not PermissionGuard.
    const { interceptor, context, next, runPlatform, logCrossTenantAccess } =
      build({
        scopedPermissions: PERMS,
        user: { userId: 'sa', tenantId: 'platform-tenant', profileId: 'p9' },
        clearanceLevel: 9,
        permissionGranted: false,
      });

    await expect(
      lastValueFrom(interceptor.intercept(context as never, next as never)),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(runPlatform).not.toHaveBeenCalled();
    expect(logCrossTenantAccess).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'sa',
        granted: false,
        failureReason: expect.stringContaining('platform.tenants.read'),
      }),
    );
  });

  it('refuses an unauthenticated request', async () => {
    const { interceptor, context, next, runPlatform, handled } = build({
      scopedPermissions: PERMS,
      user: undefined,
      clearanceLevel: 10,
    });

    await expect(
      lastValueFrom(interceptor.intercept(context as never, next as never)),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(runPlatform).not.toHaveBeenCalled();
    expect(handled).not.toHaveBeenCalled();
  });
});
