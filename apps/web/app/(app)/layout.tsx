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

import { LogIn } from 'lucide-react';

import { StateView } from '@workspace/ui/custom/states/state-view';

import { ViewerProvider } from '@/app/providers/viewer-provider';
import { getSession } from '@/lib/session';
import { AppChrome } from './app-chrome';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    return (
      <div className="grid h-svh w-full place-items-center px-6">
        <StateView
          icon={<LogIn aria-hidden />}
          tone="info"
          title="You're not signed in"
          description="Sign in to access your school. Authentication isn't available in this preview yet."
        />
      </div>
    );
  }

  return (
    <ViewerProvider session={session}>
      <AppChrome>{children}</AppChrome>
    </ViewerProvider>
  );
}
