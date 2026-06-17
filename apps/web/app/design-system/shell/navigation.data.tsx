/* ============================================================
   /design-system/shell — example viewer personas (PREVIEW ONLY)

   The navigation configs themselves are the REAL product navigation,
   now sourced from `@/lib/navigation/app-navigation` (single source
   of truth) and re-exported here for the existing preview imports.
   This file adds only the example viewer personas used by the
   preview's persona switcher to demonstrate access filtering — not
   product data.
   ============================================================ */

import type {
  PermissionKey,
  ViewerContext,
} from '@workspace/ui/types/access.types';

import {
  SCHOOL_NAV,
  PLATFORM_NAV,
  configForViewer,
} from '@/lib/navigation/app-navigation';

export { SCHOOL_NAV, PLATFORM_NAV, configForViewer };

/* ---- example viewer personas --------------------------------- */
const set = (keys: PermissionKey[]): ReadonlySet<PermissionKey> => new Set(keys);

export interface ViewerPersona {
  key: string;
  /** Short label for the preview persona switcher. */
  label: string;
  viewer: ViewerContext;
}

export const VIEWERS: ViewerPersona[] = [
  {
    key: 'registrar',
    label: 'Registrar · school',
    viewer: {
      clearanceLevel: 4,
      roles: ['Operations', 'Registrar'],
      scope: 'school',
      tenantId: 'sja',
      schoolType: 'secondary',
      permissions: set([
        'students.view',
        'students.view.detailed',
        'admissions.view',
        'attendance.view',
        'courses.view',
        'schedules.view',
        'subjects.view',
        'reports.view',
        'reports.academic',
        'settings.view',
      ]),
    },
  },
  {
    key: 'teacher',
    label: 'Teacher · school',
    viewer: {
      clearanceLevel: 3,
      roles: ['Teacher'],
      scope: 'school',
      tenantId: 'sja',
      schoolType: 'secondary',
      permissions: set([
        'students.view',
        'grades.view',
        'grades.edit.own_classes',
        'attendance.view',
        'attendance.edit.own_classes',
        'courses.view',
        'schedules.view',
        'subjects.view',
        'timetable.view',
        'transcripts.view',
      ]),
    },
  },
  {
    key: 'owner',
    label: 'Owner · school',
    viewer: {
      clearanceLevel: 8,
      roles: ['Owner'],
      scope: 'school',
      tenantId: 'sja',
      schoolType: 'secondary',
      permissions: set([
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
      ]),
    },
  },
  {
    key: 'architect',
    label: 'Architect · platform',
    viewer: {
      clearanceLevel: 10,
      roles: ['Architect'],
      scope: 'platform',
      permissions: set([
        'platform.tenants',
        'platform.monitoring',
        'analytics.advanced',
        'platform.audit',
        'platform.support',
        'platform.billing',
        'platform.security',
        'platform.maintenance',
      ]),
    },
  },
];
