/* ============================================================
   SchoolWithEase — Shell component contracts (Phase 1 / M3)

   Typed data shapes consumed by the Aurora Layout A shell
   components (AppShell, AppHeader, AppSidebar, SchoolSwitcher,
   UserMenu, AppBreadcrumbs, PageHeader). Components are
   data-driven: no sample/template data lives inside them
   (resolves TD-001). The preview surface supplies the data.
   ============================================================ */

import type * as React from 'react';

/** A tenant/school the signed-in user can switch between. */
export interface SchoolOption {
  id: string;
  name: string;
  /** Short initials shown in the brand chip, e.g. "SJ". */
  initials: string;
  /** Optional logo image; falls back to `initials` when absent. */
  logoUrl?: string;
  /** Optional secondary line, e.g. plan, location, or school type. */
  caption?: string;
  /** Optional brand tint used for the chip background. */
  color?: string;
}

/** Primary-level destination shown in the desktop rail / mobile side nav. */
export interface RailItem {
  key: string;
  label: string;
  icon: React.ReactNode;
  href?: string;
  active?: boolean;
  /** Whether this destination exposes a secondary navigation panel. */
  hasPanel?: boolean;
  /** First accessible destination inside the secondary panel. */
  panelHref?: string;
  /** Controlled-navigation equivalent of `panelHref`. */
  onPanelSelect?: () => void;
  /** Preload the section's direct route when interaction is likely. */
  onPrefetch?: () => void;
  /** Preload the first destination in a secondary panel. */
  onPanelPrefetch?: () => void;
  /** Optional count badge. */
  badge?: string | number;
  /** Optional click handler (alternative to `href`). */
  onSelect?: () => void;
}

export type NavBadgeTone = 'default' | 'hot';

/** Secondary-nav destination. May nest one level of children. */
export interface NavItem {
  key: string;
  label: string;
  icon?: React.ReactNode;
  href?: string;
  active?: boolean;
  badge?: string | number;
  badgeTone?: NavBadgeTone;
  onSelect?: () => void;
  /** Preload this destination on hover, focus, or pointer intent. */
  onPrefetch?: () => void;
  /** Nested sub-items, rendered indented beneath the parent. */
  items?: NavItem[];
}

/** A labelled cluster of secondary-nav items. */
export interface NavGroup {
  key: string;
  /** Group heading; omit for an unlabelled cluster. */
  label?: string;
  /** Render a chevron affordance on the group heading. */
  collapsible?: boolean;
  items: NavItem[];
}

/** A resolved secondary panel, available before its section becomes active. */
export interface NavPanelData {
  header?: {
    icon?: React.ReactNode;
    title: string;
    subtitle?: string;
  };
  groups: NavGroup[];
}

/** The signed-in user. */
export interface UserProfile {
  name: string;
  email?: string;
  initials: string;
  avatarUrl?: string;
  /** Optional role/clearance label, e.g. "Registrar". */
  caption?: string;
  /** Optional brand tint used for the avatar background. */
  color?: string;
}

/** An action inside the user menu. */
export interface UserMenuItem {
  key: string;
  label: string;
  icon?: React.ReactNode;
  href?: string;
  onSelect?: () => void;
  /** Render with destructive styling (e.g. sign out). */
  destructive?: boolean;
  /** Insert a separator above this item. */
  separatorBefore?: boolean;
  /** Optional trailing shortcut hint, e.g. "⇧⌘Q". */
  shortcut?: string;
}

/** A single breadcrumb segment. */
export interface BreadcrumbEntry {
  key: string;
  label: string;
  /** When omitted the segment renders as the current (non-link) page. */
  href?: string;
}

/** A short meta fact rendered in the page-header sub-line. */
export interface PageHeaderMeta {
  key: string;
  label: string;
  /** Emphasise this fact (rendered in the accent colour). */
  emphasis?: boolean;
}
