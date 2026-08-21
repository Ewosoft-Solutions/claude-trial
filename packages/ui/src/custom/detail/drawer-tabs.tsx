'use client';

/* ============================================================
   DrawerTabs — the folder-tab strip a detail drawer switches on

   The shape, the joins and the rule all live in `folder-tabs`, which
   the profile pages and the in-page section tabs draw from too. This
   file is only the drawer's flavour of it: a strip that bleeds to the
   drawer's edges and switches local state rather than a route.

   LAYOUT CONTRACT: the strip bleeds with `-mx-5`, so it expects a
   header padded `px-5`. The tabs are filled with the CONTENT ground
   (`--background`) rather than the header's `--sidebar`, because a tab
   reads as attached to the panel below it.
   ============================================================ */

import { FolderTabButtons } from '@workspace/ui/custom/detail/folder-tabs';

export {
  TAB_JOIN_REACH,
  TAB_JOIN_DEPTH,
} from '@workspace/ui/custom/detail/folder-tabs';

export interface DrawerTabsProps<TTab extends string> {
  tabs: readonly TTab[];
  /** The active tab. */
  value: TTab;
  onChange: (tab: TTab) => void;
  /** Visible label for a tab. */
  label: (tab: TTab) => React.ReactNode;
  /** Accessible name for the strip, e.g. "Person detail sections". */
  ariaLabel?: string;
  className?: string;
}

export function DrawerTabs<TTab extends string>(props: DrawerTabsProps<TTab>) {
  return <FolderTabButtons {...props} bleed={5} ground="background" />;
}
