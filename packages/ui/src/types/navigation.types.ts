/* ============================================================
   SchoolWithEase — Navigation model (Phase 1 / M4)

   A typed, declarative navigation config that drives the M3 shell
   (AppSidebar's RailItem[] / NavGroup[]). Each node carries an
   optional access guard (role / clearance / permission / scope /
   school type). `resolveNavigation` (lib/navigation.ts) filters a
   config for a ViewerContext and derives active state from the
   current route — components never see permissions or tenant logic.
   ============================================================ */

import type * as React from 'react';

import type { NavAccess, NavScope } from '@workspace/ui/types/access.types';
import type {
  NavBadgeTone,
  NavGroup,
  RailItem,
} from '@workspace/ui/types/shell.types';

/**
 * A secondary-nav destination in the config (pre-resolution). Mirrors the
 * shell `NavItem`, but carries an access guard and a route `href` used to
 * derive active state — never a hardcoded `active` flag.
 */
export interface NavNode {
  key: string;
  label: string;
  icon?: React.ReactNode;
  /** Route this node points to; also used to derive active state. */
  href?: string;
  badge?: string | number;
  badgeTone?: NavBadgeTone;
  access?: NavAccess;
  /** One level of nested children (matches the shell's support). */
  items?: NavNode[];
}

/** A labelled cluster of nav nodes in the config. */
export interface NavGroupNode {
  key: string;
  /** Group heading; omit for an unlabelled cluster. */
  label?: string;
  collapsible?: boolean;
  access?: NavAccess;
  items: NavNode[];
}

/** Header shown atop a section's secondary panel (icon + title + subtitle). */
export interface NavPanelHeaderNode {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
}

/**
 * A primary destination (icon rail / mobile tab bar) and the secondary nav
 * it reveals when active. Sections with no `groups` are rail-only links
 * (e.g. Help).
 */
export interface NavSectionNode {
  key: string;
  label: string;
  icon: React.ReactNode;
  /** Route for this section; the rail item is active when the route matches. */
  href: string;
  badge?: string | number;
  access?: NavAccess;
  /** Header for this section's secondary panel. */
  panelHeader?: NavPanelHeaderNode;
  /** Secondary-nav groups revealed when this section is active. */
  groups?: NavGroupNode[];
}

/** A full navigation surface (platform or school). */
export interface NavigationConfig {
  scope: NavScope;
  /** Primary sections shown in the icon rail / mobile tab bar. */
  sections: NavSectionNode[];
  /** Utility sections pinned to the bottom of the rail (Help, Settings…). */
  footer?: NavSectionNode[];
}

/**
 * The shell-ready result of resolving a config for a viewer + route.
 * `navHeader` is structurally the shell's `NavPanelHeader`.
 */
export interface ResolvedNavigation {
  railItems: RailItem[];
  railFooterItems: RailItem[];
  navHeader?: NavPanelHeaderNode;
  navGroups: NavGroup[];
  /** Key of the section currently active (by route), if any. */
  activeSectionKey?: string;
  /** Href of the single most-specific active route, if any. */
  activeHref?: string;
}
