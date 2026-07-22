import { describe, expect, it, vi } from 'vitest';

import { resolveNavigation } from '@workspace/ui/lib/navigation';
import type {
  ClearanceLevel,
  PermissionKey,
  RoleKey,
  ViewerContext,
} from '@workspace/ui/types/access.types';

import { PLATFORM_NAV, SCHOOL_NAV, configForViewer } from './app-navigation';

/* ---- representative viewers -----------------------------------

   These mirror the role archetypes the real `getSession()` seam yields
   (see apps/web/lib/session.ts) so the tests assert that the *shipped*
   SCHOOL_NAV / PLATFORM_NAV configs filter correctly per viewer — not a
   synthetic fixture. Permission keys are drawn straight from the config's
   access guards.
   ---------------------------------------------------------------- */

function makeViewer(overrides: Partial<ViewerContext> = {}): ViewerContext {
  return {
    clearanceLevel: 1 as ClearanceLevel,
    roles: ['Student'] as RoleKey[],
    permissions: new Set<PermissionKey>(),
    scope: 'school',
    ...overrides,
  };
}

/** All permissions a school owner might hold (used to build typed fixtures). */
const ALL_SCHOOL_PERMISSIONS = new Set<PermissionKey>([
  'ai.analytics.query',
  'ai.chat.use',
  'ai.integrity.monitor',
  'ai.configure',
  'students.view',
  'admissions.view',
  'attendance.view',
  'attendance.export',
  'courses.view',
  'schedules.view',
  'subjects.view',
  'lessons.view',
  'lessons.view.own',
  'lessons.approve',
  'classes.teachers.view',
  'classes.teachers.assign',
  'questions.view',
  'questions.create',
  'questions.edit',
  'questions.delete',
  'assessments.view',
  'assessments.create',
  'assessments.edit',
  'assessments.take',
  'grades.view',
  'transcripts.view',
  'timetable.view',
  'fees.view',
  'billing.view',
  'payments.view',
  'financial_reports.view',
  'transportation.view',
  'library.view',
  'hr.view',
  'health.view',
  'events.view',
  'reports.view',
  'reports.academic',
  'analytics.view',
  'settings.view',
  'settings.school',
  'roles.view',
  'users.view',
  'settings.audit',
]);

/** Proprietor of a secondary school — all permissions + schoolType that unlocks all sections. */
const OWNER = makeViewer({
  clearanceLevel: 8,
  roles: ['Owner'],
  schoolType: 'secondary',
  permissions: ALL_SCHOOL_PERMISSIONS,
});

/** Owner of a primary school — transport + library visible; HR is not. */
const PRIMARY_OWNER = makeViewer({
  clearanceLevel: 8,
  roles: ['Owner'],
  schoolType: 'primary',
  permissions: ALL_SCHOOL_PERMISSIONS,
});

/** Owner of a university — library + HR visible; transport is not. */
const UNIVERSITY_OWNER = makeViewer({
  clearanceLevel: 8,
  roles: ['Owner'],
  schoolType: 'university',
  permissions: ALL_SCHOOL_PERMISSIONS,
});

/** Owner with no schoolType set (e.g. organisation) — only non-gated sections. */
const UNTYPED_OWNER = makeViewer({
  clearanceLevel: 8,
  roles: ['Owner'],
  permissions: ALL_SCHOOL_PERMISSIONS,
});

/**
 * Teacher — clearance 3, classroom permissions only. Deliberately lacks
 * `admissions.view` / `transcripts.view` / finance / reports / settings so the
 * tests exercise leaf-, group-, and section-level filtering.
 */
const TEACHER = makeViewer({
  clearanceLevel: 3,
  roles: ['Teacher'],
  permissions: new Set<PermissionKey>([
    'students.view',
    'attendance.view',
    'courses.view',
    'schedules.view',
    'subjects.view',
    'lessons.view',
    'questions.view',
    'questions.create',
    'questions.edit',
    'assessments.view',
    'assessments.create',
    'assessments.edit',
    'grades.view',
    'timetable.view',
  ]),
});

/** Bursar — clearance 5, billing + financial reports. */
const FINANCE = makeViewer({
  clearanceLevel: 5,
  roles: ['Finance'],
  permissions: new Set<PermissionKey>([
    'students.view',
    'fees.view',
    'billing.view',
    'payments.view',
    'financial_reports.view',
  ]),
});

/** Platform super-admin — every platform capability. */
const PLATFORM_ADMIN = makeViewer({
  scope: 'platform',
  clearanceLevel: 9,
  roles: ['SuperAdmin'],
  permissions: new Set<PermissionKey>([
    'platform.tenants.read',
    'platform.monitoring',
    'platform.audit',
    'platform.support',
    'platform.billing',
    'platform.security',
    'platform.maintenance',
  ]),
});

/* ---- configForViewer ------------------------------------------- */

describe('configForViewer', () => {
  it('serves the school config to a school-scope viewer', () => {
    expect(configForViewer(OWNER)).toBe(SCHOOL_NAV);
  });

  it('serves the platform config to a platform-scope viewer', () => {
    expect(configForViewer(PLATFORM_ADMIN)).toBe(PLATFORM_NAV);
  });
});

/* ---- SCHOOL_NAV — section visibility --------------------------- */

describe('SCHOOL_NAV section visibility', () => {
  it('offers core sections + all schoolType-gated sections to a secondary-school owner', () => {
    const { railItems, railFooterItems } = resolveNavigation(
      SCHOOL_NAV,
      OWNER,
      '/overview',
    );
    expect(railItems.map((i) => i.key)).toEqual([
      'overview',
      'students',
      'classes',
      'attendance',
      'finance',
      'reports',
      'transport',
      'library',
      'hr',
      'health',
      'events',
      'settings',
    ]);
    expect(railFooterItems.map((i) => i.key)).toEqual(['help']);
  });

  it('hides finance/reports/settings from a teacher', () => {
    const { railItems, railFooterItems } = resolveNavigation(
      SCHOOL_NAV,
      TEACHER,
      '/overview',
    );
    expect(railItems.map((i) => i.key)).toEqual([
      'overview',
      'students',
      'classes',
      'attendance',
    ]);
    // finance (minClearance 5) and reports (no reports/analytics perm) gone
    expect(railItems.map((i) => i.key)).not.toContain('finance');
    expect(railItems.map((i) => i.key)).not.toContain('reports');
    // school settings needs an administration permission — only help remains
    expect(railFooterItems.map((i) => i.key)).toEqual(['help']);
  });

  it('offers finance to a clearance-5 bursar', () => {
    const { railItems } = resolveNavigation(SCHOOL_NAV, FINANCE, '/overview');
    expect(railItems.map((i) => i.key)).toContain('finance');
  });

  it('enforces the finance clearance gate independently of permission', () => {
    // financial_reports.view satisfies the permission clause, but clearance 3
    // is below the section's minClearance 5 → still denied.
    const underCleared = makeViewer({
      clearanceLevel: 3,
      roles: ['Finance'],
      permissions: new Set<PermissionKey>(['financial_reports.view']),
    });
    const { railItems } = resolveNavigation(
      SCHOOL_NAV,
      underCleared,
      '/overview',
    );
    expect(railItems.map((i) => i.key)).not.toContain('finance');
  });

  it('keeps AI access out of the main navigation rail', () => {
    // AI now opens from the shell FAB/workspace, so permissions must not add
    // an editable-path destination to the rail.
    const student = makeViewer({
      permissions: new Set<PermissionKey>(['ai.analytics.query']),
    });
    const { railItems } = resolveNavigation(SCHOOL_NAV, student, '/overview');
    expect(railItems.map((i) => i.key)).toEqual(['overview']);
  });

  it('offers Settings to an AI configuration admin', () => {
    const aiAdmin = makeViewer({
      clearanceLevel: 7,
      roles: ['Management'],
      permissions: new Set<PermissionKey>(['ai.configure']),
    });
    const { railItems, railFooterItems } = resolveNavigation(
      SCHOOL_NAV,
      aiAdmin,
      '/settings/ai-usage',
    );
    expect(railItems.map((i) => i.key)).toEqual(['overview', 'settings']);
    expect(railFooterItems.map((i) => i.key)).toEqual(['help']);
  });

  it('offers only the overview to a minimal student viewer', () => {
    const { railItems, railFooterItems } = resolveNavigation(
      SCHOOL_NAV,
      makeViewer(),
      '/overview',
    );
    expect(railItems.map((i) => i.key)).toEqual(['overview']);
    expect(railFooterItems.map((i) => i.key)).toEqual(['help']);
  });
});

/* ---- SCHOOL_NAV — panel groups, leaf filtering & active state -- */

describe('SCHOOL_NAV panel resolution', () => {
  it('keeps Overview as a direct role-home destination without a child panel', () => {
    const resolved = resolveNavigation(SCHOOL_NAV, TEACHER, '/overview');
    expect(resolved.activeSectionKey).toBe('overview');
    expect(resolved.railItems.find((i) => i.key === 'overview')?.hasPanel).toBe(
      false,
    );
    expect(resolved.navHeader).toBeUndefined();
    expect(resolved.navGroups).toEqual([]);
  });

  it('navigates a one-child section directly to its accessible destination', () => {
    const onNavigate = vi.fn();
    const resolved = resolveNavigation(SCHOOL_NAV, TEACHER, '/overview', {
      onNavigate,
    });
    const attendance = resolved.railItems.find(
      (item) => item.key === 'attendance',
    );

    expect(attendance?.hasPanel).toBe(false);
    attendance?.onSelect?.();
    expect(onNavigate).toHaveBeenCalledWith('/attendance/daily');
  });

  it('marks the active section + leaf and exposes the owning panel', () => {
    const resolved = resolveNavigation(
      SCHOOL_NAV,
      OWNER,
      '/students/enrollment',
    );
    expect(resolved.activeSectionKey).toBe('students');
    expect(resolved.activeHref).toBe('/students/enrollment');
    expect(resolved.navHeader?.title).toBe('Students');
    expect(resolved.railItems.find((i) => i.key === 'students')?.active).toBe(
      true,
    );
    expect(resolved.railItems.find((i) => i.key === 'overview')?.active).toBe(
      false,
    );

    const records = resolved.navGroups.find((g) => g.key === 'records');
    expect(records?.items.find((i) => i.key === 'enrollment')?.active).toBe(
      true,
    );
    expect(records?.items.find((i) => i.key === 'directory')?.active).toBe(
      false,
    );
  });

  it('filters panel items, groups, and nested leaves by permission', () => {
    const { navGroups } = resolveNavigation(SCHOOL_NAV, TEACHER, '/students');

    // student-ops (fees + transport perms) is emptied away; the rest remain
    expect(navGroups.map((g) => g.key)).toEqual(['records', 'academics']);

    const records = navGroups.find((g) => g.key === 'records');
    // enrollment needs admissions.view (teacher lacks it)
    expect(records?.items.map((i) => i.key)).toEqual([
      'directory',
      'attendance',
    ]);

    // nested: gradebook is shown (grades.view) but its transcripts child
    // (transcripts.view) is filtered out, leaving only report cards
    const academics = navGroups.find((g) => g.key === 'academics');
    const gradebook = academics?.items.find((i) => i.key === 'gradebook');
    expect(gradebook?.items?.map((i) => i.key)).toEqual(['reportcards']);
  });

  it('gates the classes Materials leaf on lessons.view', () => {
    // Teacher fixture holds lessons.view → Materials appears.
    const teacherResolved = resolveNavigation(SCHOOL_NAV, TEACHER, '/classes');
    const teaching = teacherResolved.navGroups.find(
      (g) => g.key === 'teaching',
    );
    expect(teaching?.items.map((i) => i.key)).toContain('materials');

    // Same viewer without lessons.view → Materials filtered out.
    const noLessons = makeViewer({
      clearanceLevel: 3,
      roles: ['Teacher'],
      permissions: new Set<PermissionKey>(['courses.view', 'subjects.view']),
    });
    const resolved = resolveNavigation(SCHOOL_NAV, noLessons, '/classes');
    const classes = resolved.railItems.find((item) => item.key === 'classes');
    expect(classes?.hasPanel).toBe(false);
    expect(classes?.href).toBe('/classes/subjects');
    expect(resolved.navGroups).toEqual([]);
  });

  it('keeps Study tutor and Tutor usage out of the Classes panel', () => {
    const aiEnabledTeacher = makeViewer({
      clearanceLevel: 3,
      roles: ['Teacher'],
      permissions: new Set<PermissionKey>([
        ...TEACHER.permissions,
        'ai.chat.use',
        'ai.integrity.monitor',
        'lessons.view.own',
      ]),
    });
    const teacherGroup = resolveNavigation(
      SCHOOL_NAV,
      aiEnabledTeacher,
      '/classes',
    ).navGroups.find((g) => g.key === 'teaching');
    const teacherKeys = teacherGroup?.items.map((i) => i.key) ?? [];
    expect(teacherKeys).not.toContain('tutor');
    expect(teacherKeys).not.toContain('tutor-usage');
  });

  it('gates teacher allocation on assignment permission', () => {
    const viewOnly = makeViewer({
      clearanceLevel: 3,
      roles: ['Teacher'],
      permissions: new Set<PermissionKey>([
        ...TEACHER.permissions,
        'classes.teachers.view',
      ]),
    });
    const viewOnlyResolved = resolveNavigation(
      SCHOOL_NAV,
      viewOnly,
      '/classes',
    );
    const viewOnlyTeaching = viewOnlyResolved.navGroups.find(
      (g) => g.key === 'teaching',
    );
    expect(viewOnlyTeaching?.items.map((i) => i.key)).not.toContain(
      'teacher-allocation',
    );

    const assigner = makeViewer({
      clearanceLevel: 4,
      roles: ['Operations'],
      permissions: new Set<PermissionKey>([
        ...TEACHER.permissions,
        'classes.teachers.assign',
      ]),
    });
    const assignerResolved = resolveNavigation(
      SCHOOL_NAV,
      assigner,
      '/classes',
    );
    const assignerTeaching = assignerResolved.navGroups.find(
      (g) => g.key === 'teaching',
    );
    expect(assignerTeaching?.items.map((i) => i.key)).toContain(
      'teacher-allocation',
    );
  });

  it('activates school settings as a regular section with its submenu', () => {
    const resolved = resolveNavigation(SCHOOL_NAV, OWNER, '/settings/general');
    expect(resolved.activeSectionKey).toBe('settings');
    expect(resolved.navGroups.map((group) => group.key)).toEqual([
      'school-configuration',
      'school-administration',
    ]);
    expect(resolved.railItems.find((i) => i.key === 'settings')?.active).toBe(
      true,
    );
  });
});

/* ---- SCHOOL_NAV — schoolType-gated sections -------------------- */

describe('SCHOOL_NAV schoolType visibility', () => {
  it('shows transport + library but not HR for a primary school', () => {
    const { railItems } = resolveNavigation(
      SCHOOL_NAV,
      PRIMARY_OWNER,
      '/overview',
    );
    const keys = railItems.map((i) => i.key);
    expect(keys).toContain('transport');
    expect(keys).toContain('library');
    expect(keys).not.toContain('hr');
  });

  it('shows library + HR but not transport for a university', () => {
    const { railItems } = resolveNavigation(
      SCHOOL_NAV,
      UNIVERSITY_OWNER,
      '/overview',
    );
    const keys = railItems.map((i) => i.key);
    expect(keys).not.toContain('transport');
    expect(keys).toContain('library');
    expect(keys).toContain('hr');
  });

  it('hides all schoolType-gated sections when schoolType is absent', () => {
    const { railItems } = resolveNavigation(
      SCHOOL_NAV,
      UNTYPED_OWNER,
      '/overview',
    );
    const keys = railItems.map((i) => i.key);
    expect(keys).not.toContain('transport');
    expect(keys).not.toContain('library');
    expect(keys).not.toContain('hr');
  });

  it('hides the students/transport sub-item for a university viewer', () => {
    const { navGroups } = resolveNavigation(
      SCHOOL_NAV,
      UNIVERSITY_OWNER,
      '/students',
    );
    const ops = navGroups.find((g) => g.key === 'student-ops');
    expect(ops?.items.map((i) => i.key)).not.toContain('transport');
  });

  it('shows the students/transport sub-item for a primary school viewer', () => {
    const { navGroups } = resolveNavigation(
      SCHOOL_NAV,
      PRIMARY_OWNER,
      '/students',
    );
    const ops = navGroups.find((g) => g.key === 'student-ops');
    expect(ops?.items.map((i) => i.key)).toContain('transport');
  });
});

/* ---- SCHOOL_NAV — feature toggles ------------------------------ */

describe('SCHOOL_NAV feature toggles', () => {
  it('hides the transport section when the module is toggled off', () => {
    const viewer = makeViewer({
      ...PRIMARY_OWNER,
      // library + health enabled, transport OFF
      enabledFeatures: new Set(['library', 'health', 'messaging', 'cafeteria']),
    });
    const { railItems } = resolveNavigation(SCHOOL_NAV, viewer, '/overview');
    const keys = railItems.map((i) => i.key);
    expect(keys).not.toContain('transport');
    expect(keys).toContain('library');
  });

  it('shows the transport section when the module is enabled', () => {
    const viewer = makeViewer({
      ...PRIMARY_OWNER,
      enabledFeatures: new Set(['transport', 'library', 'health']),
    });
    const { railItems } = resolveNavigation(SCHOOL_NAV, viewer, '/overview');
    expect(railItems.map((i) => i.key)).toContain('transport');
  });

  it('leaves feature-gated sections visible when enabledFeatures is absent', () => {
    // Back-compat: no enabledFeatures on the viewer → no feature gating.
    const { railItems } = resolveNavigation(
      SCHOOL_NAV,
      PRIMARY_OWNER,
      '/overview',
    );
    expect(railItems.map((i) => i.key)).toContain('transport');
  });
});

/* ---- PLATFORM_NAV ---------------------------------------------- */

describe('PLATFORM_NAV', () => {
  // Analytics/Audit/Support/Billing sections were removed in 1.4 (every link
  // 404'd — Phase 2/3 features). Only Tenants remains in the rail, with the
  // Settings footer for security-permitted viewers.
  it('offers the live platform sections to a broadly-permissioned admin', () => {
    const { railItems, railFooterItems } = resolveNavigation(
      PLATFORM_NAV,
      PLATFORM_ADMIN,
      '/platform/tenants',
    );
    expect(railItems.map((i) => i.key)).toEqual(['tenants']);
    // Has platform.security, so the Settings footer resolves.
    expect(railFooterItems.map((i) => i.key)).toEqual(['platform-settings']);
  });

  it('drops the Settings footer for an operator without platform.security', () => {
    const tenantsOnly = makeViewer({
      scope: 'platform',
      clearanceLevel: 9,
      roles: ['SuperAdmin'],
      permissions: new Set<PermissionKey>(['platform.tenants.read']),
    });
    const { railItems, railFooterItems } = resolveNavigation(
      PLATFORM_NAV,
      tenantsOnly,
      '/platform/tenants',
    );
    expect(railItems.map((i) => i.key)).toEqual(['tenants']);
    // Settings needs platform.security; Help was removed → footer is empty.
    expect(railFooterItems.map((i) => i.key)).toEqual([]);
  });

  it('marks the active platform section by route', () => {
    // /platform/tenants/all is gated on platform.tenants.read, which this
    // viewer holds. (Approvals is gated on .act, which it does not — so it is
    // correctly not reachable here.)
    const resolved = resolveNavigation(
      PLATFORM_NAV,
      PLATFORM_ADMIN,
      '/platform/tenants/all',
    );
    expect(resolved.activeSectionKey).toBe('tenants');
    expect(resolved.activeHref).toBe('/platform/tenants/all');
  });
});
