'use client';

/* ============================================================
   WorkbenchLayout — the workspace shell (F8)

   Every workbench (People, Academics, Finance, …) is the SAME
   shell with different content: an optional heading + actions, a
   PERSISTENT context bar (the academic year/term/campus/entity
   selectors a workbench inherits, so context is never re-picked
   per page — fixes C044+), and a TAB strip for the workspace's
   sections. Controlled: the host owns the active tab and renders
   the active section as `children`. Aurora-token styled; themed
   by the shared primitives (light/dark/classic-dark).
   ============================================================ */

import * as React from 'react';

import { cn } from '@workspace/ui/lib/utils';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@workspace/ui/components/tabs';
import type { WorkbenchTab } from '@workspace/ui/types/patterns.types';

export interface WorkbenchLayoutProps {
  /** Workspace title (rendered with the Aurora display gradient). */
  title?: string;
  description?: string;
  /** Right-aligned actions cluster (primary action, overflow, …). */
  actions?: React.ReactNode;
  /**
   * Persistent context bar content — the selectors the workbench inherits
   * (year/term/campus/entity). Sticks below the heading; omit for none.
   */
  context?: React.ReactNode;
  /**
   * Section tabs. Pass an empty array for a single-section workspace (e.g. the
   * People directory, where the summary cards are the selector) — the tab strip
   * is then omitted entirely and `children` renders directly under the heading.
   */
  tabs: WorkbenchTab[];
  activeTab: string;
  onTabChange?: (key: string) => void;
  /** The active section's content. */
  children: React.ReactNode;
  className?: string;
}

export function WorkbenchLayout({
  title,
  description,
  actions,
  context,
  tabs,
  activeTab,
  onTabChange,
  children,
  className,
}: WorkbenchLayoutProps) {
  return (
    <div
      data-slot="workbench"
      className={cn(
        '@container/workbench flex min-w-0 flex-col gap-4',
        className,
      )}
    >
      {(title || actions) && (
        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2.5">
          <div className="flex min-w-[min(100%,12rem)] flex-1 flex-col gap-0.5">
            {title ? (
              <h1 className="w-fit max-w-full break-words bg-[image:var(--h1-grad)] bg-clip-text pr-1 font-display text-[28px] font-bold leading-[0.95] tracking-[0] text-transparent [-webkit-background-clip:text] [-webkit-text-fill-color:transparent]">
                {title}
              </h1>
            ) : null}
            {description ? (
              <p className="text-[12.5px] text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>
          {actions ? (
            <div className="flex min-w-0 flex-wrap items-center gap-2.5 @md/workbench:ml-auto @md/workbench:w-auto">
              {actions}
            </div>
          ) : null}
        </div>
      )}

      {context ? (
        <div
          data-slot="workbench-context"
          role="group"
          aria-label="Workspace context"
          className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-[var(--radius-md)] border border-border bg-card/80 px-3 py-2 text-[12.5px] shadow-xs backdrop-blur supports-[backdrop-filter]:bg-card/70"
        >
          {context}
        </div>
      ) : null}

      {tabs.length > 0 ? (
        <Tabs
          value={activeTab}
          onValueChange={onTabChange}
          className="flex min-w-0 flex-col gap-4"
        >
          <TabsList className="w-full justify-start overflow-x-auto">
            {tabs.map((tab) => (
              <TabsTrigger
                key={tab.key}
                value={tab.key}
                disabled={tab.disabled}
                className="gap-1.5"
              >
                {tab.icon ? (
                  <span aria-hidden className="[&_svg]:size-4">
                    {tab.icon}
                  </span>
                ) : null}
                {tab.label}
                {tab.badge != null ? (
                  <span className="ml-1 inline-flex min-w-4 items-center justify-center rounded-full bg-muted px-1 text-[10.5px] font-semibold text-muted-foreground tabular-nums">
                    {tab.badge}
                  </span>
                ) : null}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Host renders only the active section; associate it for a11y. */}
          <TabsContent
            value={activeTab}
            className="min-w-0 focus-visible:outline-none"
          >
            {children}
          </TabsContent>
        </Tabs>
      ) : (
        <div className="flex min-w-0 flex-col gap-4">{children}</div>
      )}
    </div>
  );
}
