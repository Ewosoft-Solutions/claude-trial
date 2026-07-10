/**
 * Subdomain → tenant-slug resolution (multi-tenant-architecture.md).
 *
 * A school is reached at `{slug}.{rootDomain}` (e.g. `st-jude.schoolwithease.com`
 * or, in dev, `st-jude.localhost:3030`). This module extracts the tenant slug
 * from a Host header. It is pure and edge-safe (used from middleware).
 */

/** Header the middleware sets and server components read to know the tenant. */
export const TENANT_SLUG_HEADER = 'x-tenant-slug';

/** Subdomains that are never a tenant slug. */
const RESERVED = new Set(['www', 'app', 'api', 'admin', 'staging', 'preview']);

/**
 * The configured apex domain the app is served from, e.g. `schoolwithease.com`.
 * When unset, only `*.localhost` is treated as tenant-bearing (dev default),
 * so production must set NEXT_PUBLIC_ROOT_DOMAIN to enable subdomain routing.
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
    candidate = hostname.slice(0, -(`.${root}`.length));
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
