/* ============================================================
   (app) — authenticated route group layout

   Resolves the session on the server (the `getSession()` seam) and,
   when signed in, mounts the client session context (ViewerProvider)
   and the application chrome (AppChrome). Every route under `(app)`
   then renders inside the Aurora shell with role/tenant-aware
   navigation driven by the ViewerContext + Next router. Route groups
   add no path segment, so children map to `/overview`,
   `/students/...`, etc.

   When there is no session, the whole group renders the
   unauthenticated surface instead of the shell. (A real sign-in
   redirect lands with the auth flow; see lib/session.ts.)
   ============================================================ */

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { MobileNavProvider } from '@/app/providers/mobile-nav-provider';
import { ViewerProvider } from '@/app/providers/viewer-provider';
import { SwrProvider } from '@/app/providers/swr-provider';
import { SessionLifecycleProvider } from '@/app/providers/session-lifecycle-provider';
import { getSession } from '@/lib/session';
import {
  MOBILE_NAV_COOKIE,
  mobileNavPinnedFromCookie,
  SIDEBAR_COOKIE,
  sidebarExpandedFromCookie,
} from '@/lib/sidebar-preference';
import { AppChrome } from './app-chrome';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, cookieStore] = await Promise.all([getSession(), cookies()]);

  if (!session) {
    redirect('/session/resume');
  }

  // Read the persisted navigation preferences on the server so the chrome
  // renders correctly on first paint: the rail at the right width (no
  // expand→collapse flash) and phones on the surface the user chose (no
  // bottom-bar flash before the pinned rail takes over).
  const sidebarExpanded = sidebarExpandedFromCookie(
    cookieStore.get(SIDEBAR_COOKIE)?.value,
  );
  const mobileNavPinned = mobileNavPinnedFromCookie(
    cookieStore.get(MOBILE_NAV_COOKIE)?.value,
  );

  return (
    <SwrProvider>
      <ViewerProvider session={session}>
        <SessionLifecycleProvider session={session}>
          <MobileNavProvider defaultPinned={mobileNavPinned}>
            <AppChrome sidebarExpanded={sidebarExpanded}>{children}</AppChrome>
          </MobileNavProvider>
        </SessionLifecycleProvider>
      </ViewerProvider>
    </SwrProvider>
  );
}
