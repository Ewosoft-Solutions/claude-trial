import { describe, expect, it, vi } from 'vitest';

import type {
  ClearanceLevel,
  NavAccess,
  RoleKey,
  SchoolType,
  ViewerContext,
} from '@workspace/ui/types/access.types';
import type {
  NavigationConfig,
} from '@workspace/ui/types/navigation.types';
import type { NavItem } from '@workspace/ui/types/shell.types';

import {
  canAccess,
  findActiveNavItem,
  isRouteActive,
  resolveNavigation,
} from './navigation';

/* ---- fixtures -------------------------------------------------- */

function makeViewer(overrides: Partial<ViewerContext> = {}): ViewerContext {
  return {
    clearanceLevel: 3 as ClearanceLevel,
    roles: ['Teacher'] as RoleKey[],
    permissions: new Set<string>(),
    scope: 'school',
    ...overrides,
  };
}

/** A config exercising access guards at the section, group, and leaf levels. */
function makeConfig(): NavigationConfig {
  return {
    scope: 'school',
    sections: [
      { key: 'overview', label: 'Overview', icon: null, href: '/overview' },
      {
        key: 'students',
        label: 'Students',
        icon: null,
        href: '/students',
        panelHeader: { title: 'Students' },
        groups: [
          {
            key: 'directory',
            label: 'Directory',
            items: [
              { key: 'all', label: 'All Students', href: '/students' },
              {
                key: 'enroll',
                label: 'Enrollment',
                href: '/students/enrollment',
              },
            ],
          },
          {
            key: 'finance',
            label: 'Finance',
            access: { roles: ['Finance'] },
            items: [
              {
                key: 'fees',
                label: 'Fees',
                href: '/students/fees',
                access: { roles: ['Finance'] },
              },
            ],
          },
        ],
      },
      {
        key: 'admin',
        label: 'Admin',
        icon: null,
        href: '/admin',
        access: { minClearance: 8 },
        groups: [
          {
            key: 'admin-group',
            items: [
              { key: 'settings', label: 'Settings', href: '/admin/settings' },
            ],
          },
        ],
      },
    ],
    footer: [{ key: 'help', label: 'Help', icon: null, href: '/help' }],
  };
}

/* ---- canAccess ------------------------------------------------- */

describe('canAccess', () => {
  it('grants a node with no guard', () => {
    expect(canAccess(undefined, makeViewer())).toBe(true);
    expect(canAccess({}, makeViewer())).toBe(true);
  });

  it('enforces scope', () => {
    const access: NavAccess = { scope: 'platform' };
    expect(canAccess(access, makeViewer({ scope: 'platform' }))).toBe(true);
    expect(canAccess(access, makeViewer({ scope: 'school' }))).toBe(false);
  });

  it('enforces minimum clearance (inclusive)', () => {
    const access: NavAccess = { minClearance: 5 };
    expect(canAccess(access, makeViewer({ clearanceLevel: 5 }))).toBe(true);
    expect(canAccess(access, makeViewer({ clearanceLevel: 6 }))).toBe(true);
    expect(canAccess(access, makeViewer({ clearanceLevel: 4 }))).toBe(false);
  });

  it('requires at least one matching role', () => {
    const access: NavAccess = { roles: ['Finance', 'Owner'] };
    expect(canAccess(access, makeViewer({ roles: ['Owner'] }))).toBe(true);
    expect(canAccess(access, makeViewer({ roles: ['Teacher'] }))).toBe(false);
  });

  it('enforces school type', () => {
    const access: NavAccess = { schoolTypes: ['secondary'] };
    expect(
      canAccess(access, makeViewer({ schoolType: 'secondary' as SchoolType })),
    ).toBe(true);
    expect(
      canAccess(access, makeViewer({ schoolType: 'primary' as SchoolType })),
    ).toBe(false);
    // missing schoolType fails a schoolType guard
    expect(canAccess(access, makeViewer())).toBe(false);
  });

  it('requires any one of anyPermission', () => {
    const access: NavAccess = { anyPermission: ['students.view', 'students.edit'] };
    expect(
      canAccess(access, makeViewer({ permissions: new Set(['students.edit']) })),
    ).toBe(true);
    expect(
      canAccess(access, makeViewer({ permissions: new Set(['grades.view']) })),
    ).toBe(false);
  });

  it('requires all of allPermissions', () => {
    const access: NavAccess = { allPermissions: ['students.view', 'students.edit'] };
    expect(
      canAccess(
        access,
        makeViewer({ permissions: new Set(['students.view', 'students.edit']) }),
      ),
    ).toBe(true);
    expect(
      canAccess(access, makeViewer({ permissions: new Set(['students.view']) })),
    ).toBe(false);
  });

  it('ANDs all present conditions together', () => {
    const access: NavAccess = { minClearance: 5, roles: ['Finance'] };
    // role ok but clearance too low → denied
    expect(
      canAccess(access, makeViewer({ clearanceLevel: 3, roles: ['Finance'] })),
    ).toBe(false);
    // both satisfied → granted
    expect(
      canAccess(access, makeViewer({ clearanceLevel: 5, roles: ['Finance'] })),
    ).toBe(true);
  });
});

/* ---- isRouteActive --------------------------------------------- */

describe('isRouteActive', () => {
  it('is false for an undefined href', () => {
    expect(isRouteActive(undefined, '/students')).toBe(false);
  });

  it('matches an exact path', () => {
    expect(isRouteActive('/students', '/students')).toBe(true);
  });

  it('matches an ancestor route', () => {
    expect(isRouteActive('/students', '/students/enrollment')).toBe(true);
    expect(isRouteActive('/students', '/students/enrollment/42')).toBe(true);
  });

  it('does not treat a string prefix as an ancestor', () => {
    expect(isRouteActive('/students', '/students-archive')).toBe(false);
  });

  it('matches the root only exactly', () => {
    expect(isRouteActive('/', '/')).toBe(true);
    expect(isRouteActive('/', '/students')).toBe(false);
  });

  it('handles an href with a trailing slash', () => {
    expect(isRouteActive('/students/', '/students/enrollment')).toBe(true);
  });
});

/* ---- resolveNavigation ----------------------------------------- */

describe('resolveNavigation', () => {
  it('drops sections the viewer cannot access', () => {
    const resolved = resolveNavigation(makeConfig(), makeViewer(), '/overview');
    const railKeys = resolved.railItems.map((i) => i.key);
    expect(railKeys).toEqual(['overview', 'students']); // 'admin' (minClearance 8) gone
    expect(resolved.railFooterItems.map((i) => i.key)).toEqual(['help']);
  });

  it('keeps an access-gated section for an authorized viewer', () => {
    const owner = makeViewer({ clearanceLevel: 8, roles: ['Owner'] });
    const resolved = resolveNavigation(makeConfig(), owner, '/overview');
    expect(resolved.railItems.map((i) => i.key)).toContain('admin');
  });

  it('marks the active section and most-specific leaf', () => {
    const resolved = resolveNavigation(
      makeConfig(),
      makeViewer(),
      '/students/enrollment',
    );
    expect(resolved.activeSectionKey).toBe('students');
    expect(resolved.activeHref).toBe('/students/enrollment');
    expect(resolved.railItems.find((i) => i.key === 'students')?.active).toBe(true);
    expect(resolved.railItems.find((i) => i.key === 'overview')?.active).toBe(false);

    const directory = resolved.navGroups.find((g) => g.key === 'directory');
    expect(directory?.items.find((i) => i.key === 'enroll')?.active).toBe(true);
    expect(directory?.items.find((i) => i.key === 'all')?.active).toBe(false);
  });

  it('exposes only the active section panel header + groups', () => {
    const resolved = resolveNavigation(makeConfig(), makeViewer(), '/students');
    expect(resolved.navHeader?.title).toBe('Students');
    // 'finance' group is access-gated away for a Teacher
    expect(resolved.navGroups.map((g) => g.key)).toEqual(['directory']);
  });

  it('keeps access-gated groups for an authorized viewer', () => {
    const finance = makeViewer({ clearanceLevel: 5, roles: ['Finance'] });
    const resolved = resolveNavigation(makeConfig(), finance, '/students');
    expect(resolved.navGroups.map((g) => g.key)).toEqual(['directory', 'finance']);
  });

  it('returns no active section for an unmatched route', () => {
    const resolved = resolveNavigation(makeConfig(), makeViewer(), '/nowhere');
    expect(resolved.activeHref).toBeUndefined();
    expect(resolved.activeSectionKey).toBeUndefined();
    expect(resolved.navGroups).toEqual([]);
    // the rail is still rendered
    expect(resolved.railItems.length).toBeGreaterThan(0);
  });

  it('activates a footer section by its own route', () => {
    const resolved = resolveNavigation(makeConfig(), makeViewer(), '/help');
    expect(resolved.activeSectionKey).toBe('help');
    expect(resolved.railFooterItems.find((i) => i.key === 'help')?.active).toBe(
      true,
    );
    expect(resolved.navGroups).toEqual([]); // help has no groups
  });

  it('renders items as links (carrying href) by default', () => {
    const resolved = resolveNavigation(makeConfig(), makeViewer(), '/overview');
    const overview = resolved.railItems.find((i) => i.key === 'overview');
    expect(overview?.href).toBe('/overview');
    expect(overview?.onSelect).toBeUndefined();
  });

  it('dispatches via onNavigate when provided (controlled routing)', () => {
    const onNavigate = vi.fn();
    const resolved = resolveNavigation(
      makeConfig(),
      makeViewer(),
      '/overview',
      { onNavigate },
    );
    const overview = resolved.railItems.find((i) => i.key === 'overview');
    expect(overview?.href).toBeUndefined();
    expect(overview?.onSelect).toBeTypeOf('function');

    overview?.onSelect?.();
    expect(onNavigate).toHaveBeenCalledWith('/overview');
  });
});

/* ---- findActiveNavItem ----------------------------------------- */

describe('findActiveNavItem', () => {
  it('returns the deepest active descendant', () => {
    const items: NavItem[] = [
      {
        key: 'parent',
        label: 'Parent',
        active: false,
        items: [{ key: 'child', label: 'Child', active: true }],
      },
      { key: 'sibling', label: 'Sibling', active: true },
    ];
    expect(findActiveNavItem(items)?.key).toBe('child');
  });

  it('falls back to an active parent when no child is active', () => {
    const items: NavItem[] = [
      {
        key: 'parent',
        label: 'Parent',
        active: true,
        items: [{ key: 'child', label: 'Child', active: false }],
      },
    ];
    expect(findActiveNavItem(items)?.key).toBe('parent');
  });

  it('returns undefined when nothing is active', () => {
    const items: NavItem[] = [
      { key: 'a', label: 'A', active: false },
      { key: 'b', label: 'B', active: false },
    ];
    expect(findActiveNavItem(items)).toBeUndefined();
  });
});
