/**
 * Server-side access helpers.
 *
 * Call these at the top of server components / layout.tsx files
 * to enforce permission-based route protection. On failure they
 * redirect — Next.js treats redirect() as a thrown value, so no
 * explicit return is needed after the call.
 *
 * These are intentionally server-only: they call getSession() which
 * reads httpOnly cookies.
 */
import { redirect } from 'next/navigation';
import { getSession } from './session';

/**
 * Asserts the viewer has a specific permission.
 * Redirects to /unauthorized if the check fails.
 */
export async function requirePermission(permission: string): Promise<void> {
  const session = await getSession();
  if (!session || !session.permissions.includes(permission as never)) {
    redirect('/unauthorized');
  }
}

/**
 * Asserts the viewer has at least one of the listed permissions.
 * Redirects to /unauthorized if none are present.
 */
export async function requireAnyPermission(permissions: string[]): Promise<void> {
  const session = await getSession();
  if (!session) {
    redirect('/unauthorized');
  }
  const has = permissions.some((p) => session.permissions.includes(p as never));
  if (!has) {
    redirect('/unauthorized');
  }
}

/**
 * Asserts the viewer's clearance level meets the minimum.
 * Redirects to /unauthorized if it does not.
 */
export async function requireMinClearance(level: number): Promise<void> {
  const session = await getSession();
  if (!session || session.clearanceLevel < level) {
    redirect('/unauthorized');
  }
}
