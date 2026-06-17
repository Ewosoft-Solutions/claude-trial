'use client';

/* ============================================================
   ViewerProvider — auth/session seam (Phase 2)

   Supplies the signed-in `ViewerContext` (the role / clearance /
   permission / scope vocabulary the navigation model filters on) plus
   the chrome data the shell needs (user profile, switchable schools).

   ⚠ SESSION STUB. There is no auth backend yet (the auth UI flow is a
   post-Phase-1 candidate). The `SESSION` constant below is mock data;
   this provider is the single seam where a real session — from
   NextAuth / a server component / an API — will replace it. Everything
   downstream already consumes `ViewerContext`, so swapping the source
   here requires no component changes.
   ============================================================ */

import * as React from 'react';

import type {
  PermissionKey,
  ViewerContext,
} from '@workspace/ui/types/access.types';
import type { SchoolType } from '@workspace/ui/types/access.types';
import type { SchoolOption, UserProfile } from '@workspace/ui/types/shell.types';

/** A school the viewer can switch between, plus its polymorphic type. */
export interface SessionSchool extends SchoolOption {
  schoolType: SchoolType;
}

/** The raw session payload (what a real auth/session provider would yield). */
interface Session {
  user: UserProfile;
  /** Active surface for the signed-in viewer. */
  scope: ViewerContext['scope'];
  clearanceLevel: ViewerContext['clearanceLevel'];
  roles: ViewerContext['roles'];
  permissions: ReadonlySet<PermissionKey>;
  /** Schools the viewer may access (empty for a platform-scope viewer). */
  schools: SessionSchool[];
  /** Initially active tenant id (school scope). */
  defaultSchoolId?: string;
}

/* ---- mock session (replace with real auth) ------------------- */
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

const SESSION: Session = {
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
  permissions: new Set(OWNER_PERMISSIONS),
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

export function ViewerProvider({ children }: { children: React.ReactNode }) {
  const [activeSchoolId, setActiveSchoolId] = React.useState(
    SESSION.defaultSchoolId,
  );

  const value = React.useMemo<ViewerContextValue>(() => {
    const activeSchool = SESSION.schools.find((s) => s.id === activeSchoolId);

    const viewer: ViewerContext = {
      clearanceLevel: SESSION.clearanceLevel,
      roles: SESSION.roles,
      permissions: SESSION.permissions,
      scope: SESSION.scope,
      tenantId: SESSION.scope === 'school' ? activeSchoolId : undefined,
      schoolType: activeSchool?.schoolType,
    };

    // SessionSchool extends SchoolOption, so the list is assignable as-is;
    // the extra `schoolType` is simply ignored by the shell switcher.
    return {
      viewer,
      user: SESSION.user,
      schools: SESSION.schools,
      activeSchoolId: viewer.tenantId,
      setActiveSchool: setActiveSchoolId,
    };
  }, [activeSchoolId]);

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
