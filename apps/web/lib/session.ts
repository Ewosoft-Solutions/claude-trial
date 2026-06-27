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

   MOCK FALLBACK: when NEXT_PUBLIC_API_URL is not set and there is no
   access-token cookie, a hardcoded mock session is returned so local
   development without a running backend works out of the box.
   Remove the mock block once the backend is always available.
   ============================================================ */

import { cookies } from 'next/headers';
import type {
  PermissionKey,
  SchoolType,
  ViewerContext,
} from '@workspace/ui/types/access.types';
import type { SchoolOption, UserProfile } from '@workspace/ui/types/shell.types';
import { apiClient, ApiError } from './api-client';
import { COOKIE_ACCESS_TOKEN } from './auth-cookies';

/** A school the viewer can switch between, plus its polymorphic type. */
export interface SessionSchool extends SchoolOption {
  schoolType: SchoolType;
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
}

/** Shape of GET /auth/me response from apps/api */
interface MeResponse {
  user: {
    name: string;
    email: string;
    initials: string;
    caption: string;
    color: string;
  };
  scope: 'school' | 'platform';
  clearanceLevel: number;
  roles: string[];
  permissions: string[];
  defaultSchoolId?: string;
  schools: Array<{
    id: string;
    name: string;
    initials: string;
    caption: string;
    color: string;
    schoolType: string;
  }>;
}

/**
 * Resolve the signed-in session, or `null` when there is none.
 *
 * Reads the httpOnly access-token cookie and fetches /auth/me.
 * Returns null when there is no cookie or the token is invalid.
 * Falls back to the mock session in dev when the API is not configured.
 */
export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(COOKIE_ACCESS_TOKEN)?.value;

  // ── Dev fallback ────────────────────────────────────────────────────────
  // When no token is present and the API URL is not configured, return the
  // mock so the frontend is usable without a running backend.
  if (!accessToken) {
    if (!process.env.NEXT_PUBLIC_API_URL) {
      return MOCK_SESSION;
    }
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
      schools: me.schools.map((s) => ({
        id: s.id,
        name: s.name,
        initials: s.initials,
        caption: s.caption,
        color: s.color,
        schoolType: ((s.schoolType || 'secondary') as SchoolType),
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

/* ---- mock session (used in dev when no backend is running) ----------- */
const OWNER_PERMISSIONS: PermissionKey[] = [
  'students.view',
  'students.view.detailed',
  'admissions.view',
  'attendance.view',
  'attendance.export',
  'courses.view',
  'schedules.view',
  'subjects.view',
  'grades.view',
  'transcripts.view',
  'fees.view',
  'billing.view',
  'payments.view',
  'financial_reports.view',
  'transportation.view',
  'timetable.view',
  'reports.view',
  'reports.academic',
  'reports.attendance',
  'analytics.view',
  'settings.view',
  'settings.school',
  'settings.theme',
  'settings.features',
  'settings.roles',
  'settings.users',
  'settings.audit',
];

const MOCK_SESSION: Session = {
  user: {
    name: 'Mr Bello',
    email: 'owner@stjude.edu',
    initials: 'MB',
    caption: 'Proprietor',
    color: '#334155',
  },
  scope: 'school',
  clearanceLevel: 8,
  roles: ['Owner'],
  permissions: OWNER_PERMISSIONS,
  defaultSchoolId: 'sja',
  schools: [
    {
      id: 'sja',
      name: 'St. Jude Academy',
      initials: 'SJ',
      caption: 'Secondary · Spring Term 2025',
      color: '#4f6df5',
      schoolType: 'secondary',
    },
    {
      id: 'mge',
      name: 'Maple Grove Elementary',
      initials: 'MG',
      caption: 'Primary · 612 students',
      color: '#12b886',
      schoolType: 'primary',
    },
    {
      id: 'rhc',
      name: 'Riverside Heights College',
      initials: 'RH',
      caption: 'College · 2,140 students',
      color: '#8c5cff',
      schoolType: 'college',
    },
  ],
};
