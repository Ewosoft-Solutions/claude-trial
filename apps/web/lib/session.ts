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
      return getMockSession();
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

/* ---- mock sessions (used in dev when no backend is running) ----------- */

/**
 * Switch mock persona in dev by setting NEXT_PUBLIC_MOCK_PERSONA in .env.local.
 * Valid values: owner | management | itsupport | finance | operations |
 *               teacher | parent | student | superadmin
 * Defaults to 'owner' when unset.
 *
 * Example: NEXT_PUBLIC_MOCK_PERSONA=teacher
 */

const DEMO_SCHOOLS: SessionSchool[] = [
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
];

const ALL_SCHOOL_PERMISSIONS: PermissionKey[] = [
  'students.view', 'students.view.detailed', 'students.view.personal_info',
  'students.view.academic_records', 'students.edit', 'students.create',
  'students.delete', 'students.export', 'admissions.view', 'admissions.review',
  'admissions.approve', 'attendance.view', 'attendance.edit', 'attendance.create',
  'attendance.export', 'courses.view', 'courses.edit', 'courses.create',
  'schedules.view', 'schedules.edit', 'subjects.view', 'timetable.view',
  'timetable.edit', 'grades.view', 'grades.edit', 'grades.create',
  'grades.export', 'transcripts.view', 'transcripts.generate',
  'fees.view', 'fees.edit', 'fees.create', 'fees.delete', 'fees.export',
  'billing.view', 'billing.edit', 'payments.view', 'payments.edit',
  'payments.refund', 'financial_reports.view', 'financial_reports.export',
  'transportation.view', 'transportation.edit',
  'reports.view', 'reports.academic', 'reports.attendance', 'reports.financial',
  'reports.export', 'analytics.view', 'analytics.advanced',
  'settings.view', 'settings.school', 'settings.theme', 'settings.features',
  'settings.roles', 'settings.users', 'settings.audit', 'settings.integrations',
  'settings.backup', 'roles.view', 'roles.edit',
  'staff.view', 'staff.edit', 'announcements.view', 'announcements.create',
  'messages.view', 'messages.send', 'events.view', 'events.create',
  'dashboard.view', 'dashboard.customize',
];

const MOCK_PERSONAS: Record<string, Session> = {
  owner: {
    user: { name: 'Mr Bello', email: 'owner@sja.test', initials: 'MB', caption: 'Proprietor', color: '#334155' },
    scope: 'school',
    clearanceLevel: 8,
    roles: ['Owner'],
    permissions: ALL_SCHOOL_PERMISSIONS,
    defaultSchoolId: 'sja',
    schools: DEMO_SCHOOLS,
  },

  management: {
    user: { name: 'Mrs Adeyemi', email: 'principal@sja.test', initials: 'MA', caption: 'Principal', color: '#334155' },
    scope: 'school',
    clearanceLevel: 7,
    roles: ['Management'],
    permissions: [
      'students.view', 'students.view.detailed', 'students.view.personal_info',
      'students.view.academic_records', 'students.edit', 'students.create', 'students.export',
      'admissions.view', 'admissions.review', 'admissions.approve',
      'attendance.view', 'attendance.edit', 'attendance.create', 'attendance.export',
      'courses.view', 'courses.edit', 'courses.create', 'schedules.view', 'schedules.edit',
      'subjects.view', 'timetable.view', 'timetable.edit',
      'grades.view', 'grades.edit', 'grades.create', 'grades.export',
      'transcripts.view', 'transcripts.generate',
      'fees.view', 'fees.edit', 'fees.create', 'fees.export', 'billing.view',
      'payments.view', 'financial_reports.view', 'financial_reports.export',
      'transportation.view', 'reports.view', 'reports.academic', 'reports.attendance',
      'reports.financial', 'analytics.view',
      'settings.view', 'settings.school', 'settings.theme',
      'staff.view', 'announcements.view', 'announcements.create',
      'messages.view', 'messages.send', 'events.view', 'events.create',
      'dashboard.view', 'dashboard.customize',
    ] as PermissionKey[],
    defaultSchoolId: 'sja',
    schools: DEMO_SCHOOLS,
  },

  itsupport: {
    user: { name: 'Emeka Eze', email: 'itsupport@sja.test', initials: 'EE', caption: 'IT Support', color: '#334155' },
    scope: 'school',
    clearanceLevel: 6,
    roles: ['ITSupport'],
    permissions: [
      'settings.view', 'settings.school', 'settings.users', 'settings.roles',
      'settings.audit', 'settings.features', 'settings.integrations', 'settings.backup',
      'settings.theme', 'roles.view', 'roles.edit', 'dashboard.view',
      'announcements.view', 'messages.view',
    ] as PermissionKey[],
    defaultSchoolId: 'sja',
    schools: DEMO_SCHOOLS,
  },

  finance: {
    user: { name: 'Fatima Sule', email: 'bursar@sja.test', initials: 'FS', caption: 'Bursar', color: '#334155' },
    scope: 'school',
    clearanceLevel: 5,
    roles: ['Finance'],
    permissions: [
      'students.view', 'fees.view', 'fees.edit', 'fees.create', 'fees.delete', 'fees.export',
      'billing.view', 'billing.edit', 'payments.view', 'payments.edit', 'payments.refund',
      'financial_reports.view', 'financial_reports.export',
      'reports.view', 'reports.financial', 'dashboard.view', 'announcements.view', 'messages.view',
    ] as PermissionKey[],
    defaultSchoolId: 'sja',
    schools: DEMO_SCHOOLS,
  },

  operations: {
    user: { name: 'Kunle Oduya', email: 'operations@sja.test', initials: 'KO', caption: 'Operations Manager', color: '#334155' },
    scope: 'school',
    clearanceLevel: 4,
    roles: ['Operations'],
    permissions: [
      'students.view', 'schedules.view', 'timetable.view', 'transportation.view',
      'transportation.edit', 'events.view', 'events.create', 'dashboard.view',
      'announcements.view', 'messages.view',
    ] as PermissionKey[],
    defaultSchoolId: 'sja',
    schools: DEMO_SCHOOLS,
  },

  teacher: {
    user: { name: 'Mr Okafor', email: 'teacher@sja.test', initials: 'MO', caption: 'Class Teacher', color: '#334155' },
    scope: 'school',
    clearanceLevel: 3,
    roles: ['Teacher'],
    permissions: [
      'students.view', 'students.view.academic_records',
      'attendance.view', 'attendance.edit.own_classes', 'attendance.create',
      'grades.view', 'grades.edit.own_classes', 'grades.create',
      'courses.view', 'schedules.view', 'timetable.view', 'subjects.view',
      'messages.view', 'messages.send.own_classes', 'announcements.view',
      'events.view', 'dashboard.view',
    ] as PermissionKey[],
    defaultSchoolId: 'sja',
    schools: DEMO_SCHOOLS,
  },

  parent: {
    user: { name: 'Mrs Afolabi', email: 'parent@sja.test', initials: 'PA', caption: 'Parent / Guardian', color: '#334155' },
    scope: 'school',
    clearanceLevel: 2,
    roles: ['Parent'],
    permissions: [
      'grades.view.children', 'attendance.view.children', 'fees.view.own',
      'messages.view', 'parent_portal.view', 'announcements.view', 'events.view',
      'dashboard.view',
    ] as PermissionKey[],
    defaultSchoolId: 'sja',
    schools: DEMO_SCHOOLS,
  },

  student: {
    user: { name: 'Tunde Afolabi', email: 'student@sja.test', initials: 'TA', caption: 'Student · JSS 2A', color: '#334155' },
    scope: 'school',
    clearanceLevel: 1,
    roles: ['Student'],
    permissions: [
      'grades.view.own', 'attendance.view.own', 'fees.view.own',
      'schedules.view', 'announcements.view', 'events.view', 'dashboard.view',
    ] as PermissionKey[],
    defaultSchoolId: 'sja',
    schools: DEMO_SCHOOLS,
  },

  superadmin: {
    user: { name: 'Platform Admin', email: 'superadmin@platform.test', initials: 'PA', caption: 'Platform SuperAdmin', color: '#1a1a2e' },
    scope: 'platform',
    clearanceLevel: 9,
    roles: ['SuperAdmin'],
    permissions: [
      'platform.tenants', 'platform.monitoring', 'platform.audit', 'platform.audit.limited',
      'platform.security', 'platform.support', 'platform.support.access',
      'platform.billing', 'platform.backup', 'settings.view', 'analytics.advanced',
    ] as PermissionKey[],
    defaultSchoolId: undefined,
    schools: [],
  },
};

function getMockSession(): Session {
  const key = (process.env.NEXT_PUBLIC_MOCK_PERSONA ?? 'owner').toLowerCase();
  return MOCK_PERSONAS[key] ?? MOCK_PERSONAS.owner!;
}
