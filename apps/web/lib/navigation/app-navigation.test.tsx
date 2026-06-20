import { describe, expect, it } from 'vitest';

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

/** Proprietor — full clearance + every school permission. */
const OWNER = makeViewer({
  clearanceLevel: 8,
  roles: ['Owner'],
  permissions: new Set<PermissionKey>([
    'students.view',
    'admissions.view',
    'attendance.view',
    'attendance.export',
    'courses.view',
    'schedules.view',
    'subjects.view',
    'grades.view',
    'transcripts.view',
    'timetable.view',
    'fees.view',
    'billing.view',
    'payments.view',
    'financial_reports.view',
    'transportation.view',
    'reports.view',
    'reports.academic',
    'analytics.view',
    'settings.view',
    'settings.school',
  ]),
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
    'platform.tenants',
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
  it('offers every section + footer to the owner', () => {
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
    ]);
    expect(railFooterItems.map((i) => i.key)).toEqual(['help', 'settings']);
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
    // settings footer needs settings.* — only help remains
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
  it('marks the active section + leaf and exposes the owning panel', () => {
    const resolved = resolveNavigation(
      SCHOOL_NAV,
      OWNER,
      '/students/enrollment',
    );
    expect(resolved.activeSectionKey).toBe('students');
    expect(resolved.activeHref).toBe('/students/enrollment');
    expect(resolved.navHeader?.title).toBe('Students');
    expect(
      resolved.railItems.find((i) => i.key === 'students')?.active,
    ).toBe(true);
    expect(
      resolved.railItems.find((i) => i.key === 'overview')?.active,
    ).toBe(false);

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
    expect(records?.items.map((i) => i.key)).toEqual(['directory', 'attendance']);

    // nested: gradebook is shown (grades.view) but its transcripts child
    // (transcripts.view) is filtered out, leaving only report cards
    const academics = navGroups.find((g) => g.key === 'academics');
    const gradebook = academics?.items.find((i) => i.key === 'gradebook');
    expect(gradebook?.items?.map((i) => i.key)).toEqual(['reportcards']);
  });

  it('activates the group-less settings footer with an empty panel', () => {
    const resolved = resolveNavigation(SCHOOL_NAV, OWNER, '/settings');
    expect(resolved.activeSectionKey).toBe('settings');
    expect(resolved.navGroups).toEqual([]); // settings renders its own in-panel nav
    expect(
      resolved.railFooterItems.find((i) => i.key === 'settings')?.active,
    ).toBe(true);
  });
});

/* ---- PLATFORM_NAV ---------------------------------------------- */

describe('PLATFORM_NAV', () => {
  it('offers every platform section to a super-admin', () => {
    const { railItems } = resolveNavigation(
      PLATFORM_NAV,
      PLATFORM_ADMIN,
      '/platform/tenants',
    );
    expect(railItems.map((i) => i.key)).toEqual([
      'tenants',
      'analytics',
      'audit',
      'support',
      'billing',
    ]);
  });

  it('drops platform sections a scoped operator cannot reach', () => {
    const tenantsOnly = makeViewer({
      scope: 'platform',
      clearanceLevel: 7,
      roles: ['Management'],
      permissions: new Set<PermissionKey>(['platform.tenants']),
    });
    const { railItems, railFooterItems } = resolveNavigation(
      PLATFORM_NAV,
      tenantsOnly,
      '/platform/tenants',
    );
    expect(railItems.map((i) => i.key)).toEqual(['tenants']);
    // platform-settings needs platform.security/maintenance → only help remains
    expect(railFooterItems.map((i) => i.key)).toEqual(['platform-help']);
  });

  it('marks the active platform section by route', () => {
    const resolved = resolveNavigation(
      PLATFORM_NAV,
      PLATFORM_ADMIN,
      '/platform/audit/security',
    );
    expect(resolved.activeSectionKey).toBe('audit');
    expect(resolved.activeHref).toBe('/platform/audit/security');
  });
});
