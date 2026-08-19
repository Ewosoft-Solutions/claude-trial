'use client';

/* ============================================================
   Drawer chrome — the shared shell every detail drawer wears

   A drawer is a quick-look surface (docs/frontend-conventions.md §2),
   and every one of them should read as the same object. Before this
   existed each drawer re-invented its own padding, title size and
   surfaces, so they drifted: some sat on the sheet's default `p-4` with
   an unsized title, others on `px-5 pt-5` with a 22px display title.

   The pattern, in one place:

     · The BAR above and the action bar below take `bg-sidebar` — the app
       top bar's own surface (see AppHeader). Both composite over
       `--background`, so a drawer's chrome and the app's chrome are the
       same colour, and the chrome brackets the content rather than
       blending into it.

     · The CONTENT keeps the sheet's `bg-background`, which is the very
       token a page's main region uses. Cards and inputs inside a drawer
       therefore sit on the same ground, and lift the same way, as they
       do on a full page. It is also what gives a folder tab a panel to
       attach to: the tab is filled with the content's ground, so it
       reads as cut out of the bar above it.

     · The TITLE is the display face at 22px × --font-scale. Large enough
       to anchor the drawer, and deliberately below a page's own 24px
       PageTitle so a drawer never competes with the page behind it.

   Use `DrawerHeader flush` when a `DrawerTabs` strip follows: the strip
   paints the boundary rule itself, so the header must not draw a second
   one below it.
   ============================================================ */

import * as React from 'react';

import {
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@workspace/ui/components/sheet';
import { cn } from '@workspace/ui/lib/utils';

/**
 * A drawer is one of two widths — see docs/frontend-conventions.md §3.
 *
 * `standard` carries every detail drawer and every form. `wide` is only for
 * content that brings its own table or matrix (a report card, an effective-
 * access grid) and would otherwise wrap. Nothing else earns a third width: a
 * 64px difference is perceptible without being informative, which is the one
 * kind of variation worth removing.
 */
export type DrawerSize = 'standard' | 'wide';

const DRAWER_WIDTH: Record<DrawerSize, string> = {
  standard: 'sm:max-w-xl',
  wide: 'sm:max-w-2xl',
};

export interface DrawerContentProps extends React.ComponentProps<
  typeof SheetContent
> {
  size?: DrawerSize;
}

/**
 * The drawer panel. Owns the width and the column layout every drawer shares:
 * a fixed `DrawerHeader`, a `flex-1` scrolling body, and an optional pinned
 * `DrawerFooter` — so the chrome stays put while only the content moves.
 *
 * `SheetContent`'s own `sm:max-w-sm` default is left alone: it also backs the
 * nav and command-palette sheets, where a 576px floor would be wrong. Detail
 * and form drawers come through here instead.
 */
export function DrawerContent({
  size = 'standard',
  className,
  ...props
}: DrawerContentProps) {
  return (
    <SheetContent
      className={cn(
        'flex w-full flex-col gap-0 p-0',
        DRAWER_WIDTH[size],
        className,
      )}
      {...props}
    />
  );
}

export interface DrawerHeaderProps extends React.ComponentProps<'div'> {
  /**
   * Set when a `DrawerTabs` strip is the last child. The strip carries the
   * boundary rule, so the header drops its own and its bottom padding, and
   * the tabs sit flush on the boundary.
   */
  flush?: boolean;
}

export function DrawerHeader({
  flush = false,
  className,
  ...props
}: DrawerHeaderProps) {
  return (
    <SheetHeader
      className={cn(
        'gap-3 bg-sidebar px-5 pt-5',
        flush ? 'pb-0' : 'border-b border-border pb-4',
        className,
      )}
      {...props}
    />
  );
}

export function DrawerTitle({
  className,
  ...props
}: React.ComponentProps<typeof SheetTitle>) {
  return (
    <SheetTitle
      className={cn(
        'truncate font-display text-[calc(22px*var(--font-scale))] font-semibold leading-tight',
        className,
      )}
      {...props}
    />
  );
}

export function DrawerFooter({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <SheetFooter
      className={cn('border-t border-border bg-sidebar px-5 py-4', className)}
      {...props}
    />
  );
}
