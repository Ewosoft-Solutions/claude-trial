'use client';

/* ============================================================
   ViewerProvider — client-side session context

   Receives the resolved `Session` (from the server `getSession()`
   seam — see lib/session.ts) and exposes the `ViewerContext` the
   navigation model filters on, plus the chrome data the shell needs
   (user profile, switchable schools) and the active-tenant switcher.

   The provider no longer owns the session data — it is injected as a
   prop from the server layout, so the mock (and, later, real
   tokens/secrets) never ship in the client bundle. Swapping the real
   auth source happens entirely in `getSession()`; nothing here or
   downstream changes.
   ============================================================ */

import * as React from 'react';

import type { ViewerContext } from '@workspace/ui/types/access.types';
import type { SchoolOption, UserProfile } from '@workspace/ui/types/shell.types';

import type { Session } from '@/lib/session';

/* ---- context ------------------------------------------------- */
export interface ViewerContextValue {
  /** The signed-in viewer, as consumed by the navigation model. */
  viewer: ViewerContext;
  /** Profile for the shell user menu. */
  user: UserProfile;
  /** Schools available in the school switcher. */
  schools: SchoolOption[];
  /** Active tenant id (school scope), or undefined for platform scope. */
  activeSchoolId?: string;
  /** Switch the active tenant. */
  setActiveSchool: (id: string) => void;
}

const ViewerCtx = React.createContext<ViewerContextValue | null>(null);

export function ViewerProvider({
  session,
  children,
}: {
  session: Session;
  children: React.ReactNode;
}) {
  const [activeSchoolId, setActiveSchoolId] = React.useState(
    session.defaultSchoolId,
  );

  // The wire payload carries permissions as an array; derive the lookup
  // Set once (memoised on the stable session identity).
  const permissions = React.useMemo(
    () => new Set(session.permissions),
    [session.permissions],
  );

  const value = React.useMemo<ViewerContextValue>(() => {
    const activeSchool = session.schools.find((s) => s.id === activeSchoolId);

    const viewer: ViewerContext = {
      clearanceLevel: session.clearanceLevel,
      roles: session.roles,
      permissions,
      scope: session.scope,
      tenantId: session.scope === 'school' ? activeSchoolId : undefined,
      schoolType: activeSchool?.schoolType,
    };

    // SessionSchool extends SchoolOption, so the list is assignable as-is;
    // the extra `schoolType` is simply ignored by the shell switcher.
    return {
      viewer,
      user: session.user,
      schools: session.schools,
      activeSchoolId: viewer.tenantId,
      setActiveSchool: setActiveSchoolId,
    };
  }, [session, activeSchoolId, permissions]);

  return <ViewerCtx.Provider value={value}>{children}</ViewerCtx.Provider>;
}

/** Access the signed-in viewer + chrome data. Must be inside ViewerProvider. */
export function useViewer(): ViewerContextValue {
  const ctx = React.useContext(ViewerCtx);
  if (!ctx) {
    throw new Error('useViewer must be used within a <ViewerProvider>.');
  }
  return ctx;
}
