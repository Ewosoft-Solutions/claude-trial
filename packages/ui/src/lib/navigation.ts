/* ============================================================
   SchoolWithEase — Navigation resolver (Phase 1 / M4)

   Pure functions that turn a declarative NavigationConfig into the
   shell-ready RailItem[] / NavGroup[] for a given ViewerContext and
   current route:

     • canAccess        — evaluate a node's access guard.
     • isRouteActive    — is an href active for the current path?
     • resolveNavigation — filter by access + derive active state.

   No React, no side effects, no enforcement: access guards only
   decide what is *offered*. The host passes the ViewerContext from
   the session and the current pathname; the shell stays oblivious to
   roles, permissions, and tenants.
   ============================================================ */

import type {
  ClearanceLevel,
  NavAccess,
  StandardRole,
  ViewerContext,
} from '@workspace/ui/types/access.types';
import type {
  NavGroupNode,
  NavNode,
  NavSectionNode,
  NavigationConfig,
  ResolvedNavigation,
} from '@workspace/ui/types/navigation.types';
import type {
  NavGroup,
  NavItem,
  RailItem,
} from '@workspace/ui/types/shell.types';

/** Clearance level for each standard role (requirements/access-control.md). */
export const CLEARANCE_BY_ROLE: Record<StandardRole, ClearanceLevel> = {
  Architect: 10,
  SuperAdmin: 9,
  Owner: 8,
  Management: 7,
  ITSupport: 6,
  Finance: 5,
  Operations: 4,
  Teacher: 3,
  Parent: 2,
  Student: 1,
  Guest: 0,
};

/**
 * Evaluate an access guard against a viewer. All present conditions must
 * pass (AND between fields). A node with no guard is always accessible.
 */
export function canAccess(
  access: NavAccess | undefined,
  viewer: ViewerContext,
): boolean {
  if (!access) return true;

  if (access.scope && access.scope !== viewer.scope) return false;

  if (
    access.minClearance != null &&
    viewer.clearanceLevel < access.minClearance
  ) {
    return false;
  }

  if (
    access.roles &&
    !access.roles.some((role) => viewer.roles.includes(role))
  ) {
    return false;
  }

  if (access.schoolTypes) {
    if (!viewer.schoolType || !access.schoolTypes.includes(viewer.schoolType)) {
      return false;
    }
  }

  // Feature gating only applies when the viewer supplies its enabled set;
  // otherwise (undefined) feature-gated nodes stay visible for back-compat.
  if (access.features && viewer.enabledFeatures) {
    const enabled = viewer.enabledFeatures;
    if (!access.features.every((feature) => enabled.has(feature))) {
      return false;
    }
  }

  if (
    access.anyPermission &&
    !access.anyPermission.some((key) => viewer.permissions.has(key))
  ) {
    return false;
  }

  if (
    access.allPermissions &&
    !access.allPermissions.every((key) => viewer.permissions.has(key))
  ) {
    return false;
  }

  return true;
}

/**
 * Whether `href` is active for `currentPath`: an exact match, or an ancestor
 * route of the current path (e.g. `/students` is active on
 * `/students/enrollment`). The root `/` only matches exactly.
 */
export function isRouteActive(
  href: string | undefined,
  currentPath: string,
): boolean {
  if (!href) return false;
  if (href === currentPath) return true;
  if (href === '/') return false;
  const prefix = href.endsWith('/') ? href : `${href}/`;
  return currentPath.startsWith(prefix);
}

/** Options controlling how resolved items dispatch navigation. */
export interface ResolveNavigationOptions {
  /**
   * When provided, resolved items call this with their href (e.g.
   * `router.push`) via `onSelect` and omit `href`, so the host fully
   * controls routing. When omitted, items render as links carrying `href`.
   */
  onNavigate?: (href: string) => void;
  /** Preload a likely destination without changing route state. */
  onPrefetch?: (href: string) => void;
}

/**
 * Resolve a navigation config for a viewer and the current route into the
 * shell-ready shape consumed by `AppSidebar`. Nodes the viewer cannot access
 * are dropped; empty groups and group-less panels collapse away. Exactly one
 * leaf (the most specific matching route) is marked active, along with the
 * section that owns it.
 */
export function resolveNavigation(
  config: NavigationConfig,
  viewer: ViewerContext,
  currentPath: string,
  options: ResolveNavigationOptions = {},
): ResolvedNavigation {
  const { onNavigate, onPrefetch } = options;

  const sections = config.sections.filter((s) => canAccess(s.access, viewer));
  const footer = (config.footer ?? []).filter((s) =>
    canAccess(s.access, viewer),
  );
  const allSections = [...sections, ...footer];

  // Collect every access-visible href, then pick the single most-specific
  // (longest) one that is active for the current path.
  const hrefs: string[] = [];
  for (const section of allSections) {
    hrefs.push(section.href);
    collectGroupHrefs(section.groups, viewer, hrefs);
  }
  const activeHref = bestActiveHref(hrefs, currentPath);

  // The active section owns activeHref (its own href or a descendant), or —
  // failing that — is the section whose href is an ancestor of currentPath.
  const activeSection =
    allSections.find(
      (s) => s.href === activeHref || ownsHref(s.groups, viewer, activeHref),
    ) ?? allSections.find((s) => isRouteActive(s.href, currentPath));

  const resolvedPanels = new Map(
    allSections.map((section) => [
      section.key,
      section.groups
        ? resolveGroups(
            section.groups,
            viewer,
            activeHref,
            onNavigate,
            onPrefetch,
          )
        : [],
    ]),
  );
  const panelHrefs = new Map(
    allSections.map((section) => {
      const hrefs: string[] = [];
      collectGroupHrefs(section.groups, viewer, hrefs);
      return [section.key, hrefs];
    }),
  );
  const navPanels = Object.fromEntries(
    allSections.flatMap((section) => {
      const groups = resolvedPanels.get(section.key) ?? [];
      return (panelHrefs.get(section.key)?.length ?? 0) > 1
        ? [[section.key, { header: section.panelHeader, groups }]]
        : [];
    }),
  );

  const toRail = (section: NavSectionNode): RailItem =>
    toRailItem(
      section,
      section.key === activeSection?.key,
      panelHrefs.get(section.key) ?? [],
      onNavigate,
      onPrefetch,
    );
  const activeGroups = activeSection
    ? (panelHrefs.get(activeSection.key)?.length ?? 0) > 1
      ? (resolvedPanels.get(activeSection.key) ?? [])
      : []
    : [];

  return {
    railItems: sections.map(toRail),
    railFooterItems: footer.map(toRail),
    navHeader: activeSection?.panelHeader,
    navGroups: activeGroups,
    navPanels,
    activeSectionKey: activeSection?.key,
    activeHref,
  };
}

/**
 * Find the deepest active leaf among resolved nav items (depth-first), so a
 * host can derive the page title / breadcrumb leaf from the active route.
 * Prefers the most specific (deepest) active descendant.
 */
export function findActiveNavItem(items: NavItem[]): NavItem | undefined {
  for (const item of items) {
    const child = item.items ? findActiveNavItem(item.items) : undefined;
    if (child) return child;
    if (item.active) return item;
  }
  return undefined;
}

/* ---- internals ------------------------------------------------ */

function toRailItem(
  section: NavSectionNode,
  active: boolean,
  panelHrefs: string[],
  onNavigate?: (href: string) => void,
  onPrefetch?: (href: string) => void,
): RailItem {
  const panelHref = panelHrefs[0];
  const hasPanel = panelHrefs.length > 1;
  const directHref = panelHrefs.length === 1 ? panelHref : section.href;
  return {
    key: section.key,
    label: section.label,
    icon: section.icon,
    badge: section.badge,
    hasPanel,
    active,
    ...navTarget(directHref ?? section.href, onNavigate, onPrefetch),
    ...(hasPanel && panelHref
      ? panelNavTarget(panelHref, onNavigate, onPrefetch)
      : {}),
  };
}

function resolveGroups(
  groups: NavGroupNode[],
  viewer: ViewerContext,
  activeHref: string | undefined,
  onNavigate?: (href: string) => void,
  onPrefetch?: (href: string) => void,
): NavGroup[] {
  const out: NavGroup[] = [];
  for (const group of groups) {
    if (!canAccess(group.access, viewer)) continue;
    const items = resolveNodes(
      group.items,
      viewer,
      activeHref,
      onNavigate,
      onPrefetch,
    );
    if (items.length === 0) continue; // drop groups emptied by access
    out.push({
      key: group.key,
      label: group.label,
      collapsible: group.collapsible,
      items,
    });
  }
  return out;
}

function resolveNodes(
  nodes: NavNode[],
  viewer: ViewerContext,
  activeHref: string | undefined,
  onNavigate?: (href: string) => void,
  onPrefetch?: (href: string) => void,
): NavItem[] {
  const out: NavItem[] = [];
  for (const node of nodes) {
    if (!canAccess(node.access, viewer)) continue;
    const children = node.items
      ? resolveNodes(node.items, viewer, activeHref, onNavigate, onPrefetch)
      : undefined;
    out.push({
      key: node.key,
      label: node.label,
      icon: node.icon,
      badge: node.badge,
      badgeTone: node.badgeTone,
      active: node.href != null && node.href === activeHref,
      items: children && children.length > 0 ? children : undefined,
      ...(node.href ? navTarget(node.href, onNavigate, onPrefetch) : {}),
    });
  }
  return out;
}

/** Either an `onSelect` callback (controlled) or an `href` (link). */
function navTarget(
  href: string,
  onNavigate?: (href: string) => void,
  onPrefetch?: (href: string) => void,
):
  | { onSelect: () => void; onPrefetch?: () => void }
  | { href: string; onPrefetch?: () => void } {
  const prefetch = onPrefetch ? () => onPrefetch(href) : undefined;
  return onNavigate
    ? { onSelect: () => onNavigate(href), onPrefetch: prefetch }
    : { href, onPrefetch: prefetch };
}

function panelNavTarget(
  href: string,
  onNavigate?: (href: string) => void,
  onPrefetch?: (href: string) => void,
):
  | { onPanelSelect: () => void; onPanelPrefetch?: () => void }
  | { panelHref: string; onPanelPrefetch?: () => void } {
  const prefetch = onPrefetch ? () => onPrefetch(href) : undefined;
  return onNavigate
    ? { onPanelSelect: () => onNavigate(href), onPanelPrefetch: prefetch }
    : { panelHref: href, onPanelPrefetch: prefetch };
}

function collectGroupHrefs(
  groups: NavGroupNode[] | undefined,
  viewer: ViewerContext,
  acc: string[],
): void {
  if (!groups) return;
  for (const group of groups) {
    if (!canAccess(group.access, viewer)) continue;
    collectNodeHrefs(group.items, viewer, acc);
  }
}

function collectNodeHrefs(
  nodes: NavNode[],
  viewer: ViewerContext,
  acc: string[],
): void {
  for (const node of nodes) {
    if (!canAccess(node.access, viewer)) continue;
    if (node.href) acc.push(node.href);
    if (node.items) collectNodeHrefs(node.items, viewer, acc);
  }
}

function ownsHref(
  groups: NavGroupNode[] | undefined,
  viewer: ViewerContext,
  activeHref: string | undefined,
): boolean {
  if (!groups || !activeHref) return false;
  const acc: string[] = [];
  collectGroupHrefs(groups, viewer, acc);
  return acc.includes(activeHref);
}

function bestActiveHref(
  hrefs: string[],
  currentPath: string,
): string | undefined {
  let best: string | undefined;
  for (const href of hrefs) {
    if (!isRouteActive(href, currentPath)) continue;
    if (best === undefined || href.length > best.length) best = href;
  }
  return best;
}
