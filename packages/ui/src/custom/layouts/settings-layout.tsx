'use client';

/* ============================================================
   SettingsLayout + SettingsNav — settings surface scaffold

   A section nav beside a content panel. At md+ the nav is a sticky
   vertical list; on mobile it collapses to a horizontal scroller
   above the content. SettingsNav is data-driven (SettingsNavItem[])
   and marks the active section with aria-current; SettingsLayout
   also accepts a custom nav node. Slots + typed data only.
   ============================================================ */

import * as React from 'react';

import { cn } from '@workspace/ui/lib/utils';
import type { SettingsNavItem } from '@workspace/ui/types/layout.types';

export interface SettingsNavProps {
  items: SettingsNavItem[];
  className?: string;
}

export function SettingsNav({ items, className }: SettingsNavProps) {
  return (
    <nav
      data-slot="settings-nav"
      className={cn(
        'flex gap-1 overflow-x-auto pb-1 @3xl/main:flex-col @3xl/main:overflow-visible @3xl/main:pb-0',
        className,
      )}
    >
      {items.map((item) => {
        const itemClass = cn(
          'group flex shrink-0 items-center gap-2.5 rounded-[var(--radius-sm)] px-3 py-2 text-left text-[13px] outline-none transition-colors @3xl/main:shrink',
          'focus-visible:ring-[3px] focus-visible:ring-ring/50',
          item.active
            ? 'bg-secondary font-semibold text-foreground'
            : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
        );
        const inner = (
          <>
            {item.icon ? (
              <span aria-hidden className="shrink-0 [&_svg]:size-4">
                {item.icon}
              </span>
            ) : null}
            <span className="min-w-0">
              <span className="block break-words">{item.label}</span>
              {item.description ? (
                <span className="hidden break-words text-[11.5px] font-normal text-muted-foreground @3xl/main:block">
                  {item.description}
                </span>
              ) : null}
            </span>
          </>
        );
        const current = item.active ? ('page' as const) : undefined;

        if (item.href) {
          return (
            <a
              key={item.key}
              href={item.href}
              onClick={item.onSelect}
              aria-current={current}
              className={itemClass}
            >
              {inner}
            </a>
          );
        }
        return (
          <button
            key={item.key}
            type="button"
            onClick={item.onSelect}
            aria-current={current}
            className={itemClass}
          >
            {inner}
          </button>
        );
      })}
    </nav>
  );
}

export interface SettingsLayoutProps {
  /** Section nav: either SettingsNavItem[] or a custom node. */
  nav: SettingsNavItem[] | React.ReactNode;
  /** Active section content. */
  children: React.ReactNode;
  /** Nav column width at md+. Defaults to 220px. */
  navWidth?: number;
  /** Optional header above both columns (e.g. <PageHeader/>). */
  header?: React.ReactNode;
  className?: string;
}

export function SettingsLayout({
  nav,
  children,
  navWidth = 220,
  header,
  className,
}: SettingsLayoutProps) {
  const navNode = Array.isArray(nav) ? <SettingsNav items={nav} /> : nav;

  return (
    <div
      data-slot="settings-layout"
      style={{ ['--settings-nav-width' as string]: `${navWidth}px` }}
      className={cn('flex w-full flex-col gap-5', className)}
    >
      {header}
      <div className="flex flex-col gap-5 @3xl/main:flex-row @3xl/main:gap-8">
        <div className="@3xl/main:w-[var(--settings-nav-width)] @3xl/main:shrink-0">
          <div className="@3xl/main:sticky @3xl/main:top-4">{navNode}</div>
        </div>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
