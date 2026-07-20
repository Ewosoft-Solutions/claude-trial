/**
 * Optional development/legacy host → tenant-slug hint.
 *
 * Production is served from one canonical multitenant origin and resolves the
 * tenant from authenticated school/profile context. This pure, edge-safe helper
 * remains useful for `{slug}.localhost` previews and explicitly configured
 * legacy environments; it is not an authorization boundary.
 */

/** Header the middleware sets and server components read to know the tenant. */
export const TENANT_SLUG_HEADER = 'x-tenant-slug';

/** Subdomains that are never a tenant slug. */
const RESERVED = new Set(['www', 'app', 'api', 'admin', 'staging', 'preview']);

/**
 * Optional root domain for a legacy host-based preview. Leave unset in the
 * canonical production deployment; `*.localhost` still works for development.
 */
export function rootDomain(): string | undefined {
  return process.env.NEXT_PUBLIC_ROOT_DOMAIN?.trim() || undefined;
}

/**
 * Extract the tenant slug from a host, or `null` when the host is the apex,
 * a reserved subdomain, or doesn't sit under the expected root.
 *
 * @param host  the raw Host header (may include a `:port`)
 * @param root  the apex domain; defaults to `rootDomain()`
 */
export function extractTenantSlug(
  host: string | null | undefined,
  root: string | undefined = rootDomain(),
): string | null {
  if (!host) return null;

  // Strip port and lowercase.
  const hostname = host.split(':')[0]!.trim().toLowerCase();
  if (!hostname) return null;

  // Plain IPs never carry a subdomain slug.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) return null;

  let candidate: string | null = null;

  if (hostname.endsWith('.localhost')) {
    // `slug.localhost` (dev) — everything before `.localhost`.
    candidate = hostname.slice(0, -'.localhost'.length);
  } else if (root && hostname.endsWith(`.${root}`)) {
    candidate = hostname.slice(0, -`.${root}`.length);
  } else {
    return null;
  }

  if (!candidate) return null;
  // Only the left-most label is the tenant slug (ignore any deeper nesting).
  const slug = candidate.split('.')[0]!;
  if (!slug || RESERVED.has(slug)) return null;
  // Slugs are lowercase alphanumeric + hyphens.
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(slug)) return null;

  return slug;
}
