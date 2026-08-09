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

import { ViewerProvider } from '@/app/providers/viewer-provider';
import { SwrProvider } from '@/app/providers/swr-provider';
import { SessionLifecycleProvider } from '@/app/providers/session-lifecycle-provider';
import { getSession } from '@/lib/session';
import {
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

  // Read the persisted rail state on the server so its width renders correctly
  // on first paint (no expand→collapse flash on refresh).
  const sidebarExpanded = sidebarExpandedFromCookie(
    cookieStore.get(SIDEBAR_COOKIE)?.value,
  );

  return (
    <SwrProvider>
      <ViewerProvider session={session}>
        <SessionLifecycleProvider session={session}>
          <AppChrome sidebarExpanded={sidebarExpanded}>{children}</AppChrome>
        </SessionLifecycleProvider>
      </ViewerProvider>
    </SwrProvider>
  );
}
