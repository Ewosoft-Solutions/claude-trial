/* ============================================================
   Session seam — the single source of the signed-in session

   `getSession()` is THE seam where authentication plugs in. Today it
   returns mock data (there is no auth backend yet — the auth UI flow
   is a post-Phase-1 candidate). When auth lands, replace only this
   function's body — read the session from NextAuth / a cookie / an
   API — and everything downstream is unchanged:

     getSession()  →  (app) layout (server)  →  <ViewerProvider session>
                   →  ViewerContext  →  the navigation model

   This module is server-only (no `'use client'`): it runs in the
   server layout so the mock — and, later, real secrets/tokens — never
   ship in the client bundle. The returned `Session` is passed across
   the server→client boundary as a plain, serializable payload, so
   `permissions` is an array here (the client provider builds the Set).
   ============================================================ */

import type {
  PermissionKey,
  SchoolType,
  ViewerContext,
} from '@workspace/ui/types/access.types';
import type { SchoolOption, UserProfile } from '@workspace/ui/types/shell.types';

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

/* ---- mock session (replace with the real auth lookup) -------- */
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

/**
 * Resolve the signed-in session, or `null` when there is none.
 *
 * ⚠ STUB: returns mock data. Replace the body with the real lookup
 * when auth lands; the signature (`Promise<Session | null>`) is the
 * contract the rest of the app already builds on. `null` drives the
 * unauthenticated surface in the `(app)` layout.
 */
export async function getSession(): Promise<Session | null> {
  return MOCK_SESSION;
}
