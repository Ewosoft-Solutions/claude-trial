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
import type { UserProfile } from '@workspace/ui/types/shell.types';

import type { Session, SessionSchool } from '@/lib/session';

/* ---- context ------------------------------------------------- */
export interface ViewerContextValue {
  /** The signed-in viewer, as consumed by the navigation model. */
  viewer: ViewerContext;
  /** Profile for the shell user menu. */
  user: UserProfile;
  /** Schools available in the school switcher, each carrying its full
   *  `profiles[]` so callers can build a per-profile switcher. */
  schools: SessionSchool[];
  /** Active tenant id (school scope), or undefined for platform scope. */
  activeSchoolId?: string;
  /** Switch the active tenant. */
  setActiveSchool: (id: string) => void;
  /** The profile (role) the current session is active as — distinguishes
   *  which of a user's several profiles at the same school is live. */
  activeProfileId?: string;
  /** Switch to a different profile the signed-in user holds (a different
   *  role at the same school, or a different school). Re-authenticates via
   *  POST /api/auth/switch-profile and reloads, since the new role,
   *  clearance level and permissions all come from a fresh access token. */
  switchProfile: (tenantId: string, profileId: string) => Promise<void>;
  /** The profile id the user has pinned as their sign-in default — the
   *  stored preference (Account settings › Profile), not necessarily the
   *  one active right now. */
  defaultProfileId?: string;
  /** Persist a new sign-in default via PATCH /api/auth/default-profile.
   *  Does not affect the current session — only future logins. */
  setDefaultProfile: (profileId: string) => Promise<void>;
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
  const [defaultProfileId, setDefaultProfileIdState] = React.useState(
    session.defaultProfileId,
  );

  // The wire payload carries permissions as an array; derive the lookup
  // Set once (memoised on the stable session identity).
  const permissions = React.useMemo(
    () => new Set(session.permissions),
    [session.permissions],
  );

  // Swaps the access/refresh cookies for the chosen profile, then does a
  // full navigation to the shared landing page — role, clearanceLevel and
  // permissions all come from the fresh access token and must be re-derived
  // server-side via getSession(), not patched in client state.
  //
  // Deliberately navigates to /overview rather than reloading the current
  // URL: a page gated by requirePermission()/requireMinClearance() (see
  // lib/access.ts) that was valid for the old profile may not be valid for
  // the new one, and reloading in place would land on /unauthorized — which
  // is meant for a mistaken navigation, not a deliberate context switch.
  // /overview renders a different dashboard per clearance level, so it's
  // valid for every profile.
  const switchProfile = React.useCallback(async (tenantId: string, profileId: string) => {
    const res = await fetch('/api/auth/switch-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId, profileId }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? 'Failed to switch profile');
    }
    window.location.href = '/overview';
  }, []);

  // Persists the sign-in default; unlike switchProfile this doesn't change
  // anything about the current session, so no reload is needed — just
  // reflect the new default in local state for the settings UI.
  const setDefaultProfile = React.useCallback(async (profileId: string) => {
    const res = await fetch('/api/auth/default-profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profileId }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? 'Failed to set default profile');
    }
    setDefaultProfileIdState(profileId);
  }, []);

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
      activeProfileId: session.activeProfileId,
      switchProfile,
      defaultProfileId,
      setDefaultProfile,
    };
  }, [session, activeSchoolId, permissions, defaultProfileId, switchProfile, setDefaultProfile]);

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
