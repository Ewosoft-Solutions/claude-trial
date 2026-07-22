import { SetMetadata } from '@nestjs/common';
import { ClearanceLevel } from '@workspace/api';
import { PLATFORM_SCOPED_KEY } from '../../common/database/rls-platform.interceptor';

/**
 * Minimum clearance for any cross-tenant access (SuperAdmin). Matches the seed,
 * which routes `category: 'platform'` permissions only into the 9–10 pools.
 */
export const PLATFORM_MIN_CLEARANCE = ClearanceLevel.SUPER_ADMIN;

/**
 * Marks a handler as platform-scoped: it runs inside the audited cross-tenant
 * RLS scope (`app.is_platform='on'`) instead of a single-tenant scope, so its
 * services read through `TenantDbService.client` and see every tenant.
 *
 * Authorization and scope are bound into this one decorator: opening
 * cross-tenant access is the widest thing this system can do, so it must not be
 * possible to apply the scope and forget the permission check.
 *
 * The check runs in `RlsPlatformInterceptor`, not in `PermissionGuard` —
 * deliberately, so that refused attempts are audited rather than short-circuited
 * before the audit path. Requires clearance >= 9 AND any one of `permissions`;
 * no `@UseGuards` wiring is needed beyond normal authentication.
 *
 * ```ts
 * @Get('overview')
 * @PlatformScoped(['platform.tenants.read'])
 * async overview() { ... }
 * ```
 *
 * @param permissions One or more `platform.*` permissions; ANY grants access.
 */
export const PlatformScoped = (permissions: string[]) => {
  if (!permissions?.length) {
    throw new Error(
      'PlatformScoped requires at least one permission — cross-tenant access must always be permission-gated.',
    );
  }

  const nonPlatform = permissions.filter((p) => !p.startsWith('platform.'));
  if (nonPlatform.length) {
    throw new Error(
      `PlatformScoped only accepts platform.* permissions; got: ${nonPlatform.join(', ')}`,
    );
  }

  return (target: unknown, key?: string, descriptor?: PropertyDescriptor) => {
    SetMetadata(PLATFORM_SCOPED_KEY, permissions)(target, key, descriptor);
  };
};
