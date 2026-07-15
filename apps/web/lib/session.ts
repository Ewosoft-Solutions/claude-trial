/* ============================================================
   Session seam — the single source of the signed-in session

   `getSession()` is THE seam where authentication plugs in.
   It reads the access-token cookie set by /api/auth/login and exchanges it
   for the full session payload via GET /auth/me on the NestJS backend.

     getSession()  →  (app) layout (server)  →  <ViewerProvider session>
                   →  ViewerContext  →  the navigation model

   This module is server-only (no `'use client'`): it runs in the
   server layout so cookies/tokens never ship in the client bundle.
   The returned `Session` is passed across the server→client boundary as a
   plain, serializable payload, so `permissions` is an array here (the
   client provider derives the lookup Set).

   No development bypass is returned here: local and remote dev should use the
   database dev seeds plus the real auth flow, so authorization bugs are
   visible during implementation.
   ============================================================ */

import { cookies } from 'next/headers';
import type {
  FeatureKey,
  PermissionKey,
  SchoolType,
  ViewerContext,
} from '@workspace/ui/types/access.types';
import type {
  SchoolOption,
  UserProfile,
} from '@workspace/ui/types/shell.types';
import { apiClient, ApiError } from './api-client';
import { COOKIE_ACCESS_TOKEN } from './auth-cookies';

/** One profile (role) a viewer holds at a given school — a user can hold
 *  more than one (e.g. parent + teacher at the same school). */
export interface SessionSchoolProfile {
  profileId: string;
  role: string;
  caption: string;
}

/** A school the viewer can switch between, plus its polymorphic type.
 *  `caption` reflects the viewer's first/active profile at this school;
 *  `profiles` carries the full set for a future profile switcher. */
export interface SessionSchool extends SchoolOption {
  schoolType: SchoolType;
  profiles?: SessionSchoolProfile[];
  /** Modules enabled for this school (feature toggles). */
  enabledFeatures: FeatureKey[];
}

/**
 * The resolved session payload a real auth/session provider yields.
 * Kept plainly serializable for the server→client boundary: `permissions`
 * is an array (not a `Set`) — the client provider derives the lookup Set.
 */
export interface Session {
  user: UserProfile;
  /** Active surface for the signed-in viewer. */
  scope: ViewerContext['scope'];
  clearanceLevel: ViewerContext['clearanceLevel'];
  roles: ViewerContext['roles'];
  permissions: readonly PermissionKey[];
  /** Schools the viewer may access (empty for a platform-scope viewer). */
  schools: SessionSchool[];
  /** Initially active tenant id (school scope). */
  defaultSchoolId?: string;
  /** The profile the current access token was issued for — used to
   *  highlight which profile is active when a user holds more than one
   *  (e.g. Teacher vs Parent at the same school). */
  activeProfileId?: string;
  /** The profile id the user has pinned as their sign-in default (Account
   *  preferences › Schools & roles) — the stored preference, not necessarily active
   *  right now. Undefined when the user hasn't set one. */
  defaultProfileId?: string;
}

/** Shape of GET /auth/me response from apps/api */
interface MeResponse {
  user: {
    name: string;
    email: string;
    initials: string;
    caption: string;
    color: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
  };
  scope: 'school' | 'platform';
  clearanceLevel: number;
  roles: string[];
  permissions: string[];
  defaultSchoolId?: string;
  activeProfileId?: string;
  defaultProfileId?: string;
  schools: Array<{
    id: string;
    name: string;
    initials: string;
    color: string;
    schoolType: string;
    enabledFeatures?: string[];
    profiles: Array<{ profileId: string; role: string; caption: string }>;
  }>;
}

/**
 * Resolve the signed-in session, or `null` when there is none.
 *
 * Reads the httpOnly access-token cookie and fetches /auth/me.
 * Returns null when there is no cookie or the token is invalid.
 */
export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(COOKIE_ACCESS_TOKEN)?.value;

  if (!accessToken) {
    return null;
  }

  // ── Real auth ───────────────────────────────────────────────────────────
  try {
    const me = await apiClient.get<MeResponse>('/auth/me', {
      Authorization: `Bearer ${accessToken}`,
    });

    return {
      user: me.user,
      scope: me.scope,
      clearanceLevel: me.clearanceLevel as ViewerContext['clearanceLevel'],
      roles: me.roles,
      permissions: me.permissions as PermissionKey[],
      defaultSchoolId: me.defaultSchoolId,
      activeProfileId: me.activeProfileId,
      defaultProfileId: me.defaultProfileId,
      schools: me.schools.map((s) => ({
        id: s.id,
        name: s.name,
        initials: s.initials,
        // Caption reflects the currently active profile at this school
        // when known, falling back to the first profile otherwise.
        caption:
          s.profiles.find((p) => p.profileId === me.activeProfileId)?.caption ??
          s.profiles[0]?.caption ??
          'Staff',
        color: s.color,
        schoolType: (s.schoolType || 'secondary') as SchoolType,
        enabledFeatures: (s.enabledFeatures ?? []) as FeatureKey[],
        profiles: s.profiles,
      })),
    };
  } catch (err) {
    if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
      return null;
    }
    // Unexpected error — log and fall through to null (unauthenticated state)
    console.error('[getSession] /auth/me error:', err);
    return null;
  }
}
