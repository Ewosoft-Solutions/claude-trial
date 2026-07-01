/* ============================================================
   AppBreadcrumbs — data-driven breadcrumb trail (top bar)

   Wraps the shared breadcrumb primitive so the shell can render
   a typed `BreadcrumbEntry[]`. The last entry (or any entry
   without an `href`) renders as the current page.

   The top bar's left column has a fixed max-width (see AppHeader) so
   the center search stays put regardless of route depth — a long
   trail must degrade gracefully rather than growing unbounded. Above
   `maxVisible` items, the middle collapses into a single "…" entry,
   keeping the first (root) and the last two (immediate context)
   segments visible — the same pattern GitHub/VS Code use for deep
   paths.
   ============================================================ */

import * as React from 'react';

import { cn } from '@workspace/ui/lib/utils';
import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@workspace/ui/components/breadcrumb';
import type { BreadcrumbEntry } from '@workspace/ui/types/shell.types';

export interface AppBreadcrumbsProps {
  items: BreadcrumbEntry[];
  /** Custom separator node; defaults to a slash to match Aurora. */
  separator?: React.ReactNode;
  /** Collapse the middle into "…" once the trail exceeds this many
   *  segments, keeping the root and the last two. Default 4. */
  maxVisible?: number;
  className?: string;
}

/** Keeps the first and last two entries, collapsing the rest into a
 *  single non-navigable ellipsis marker once the trail is too deep. */
function collapseTrail(
  items: BreadcrumbEntry[],
  maxVisible: number,
): Array<BreadcrumbEntry | { key: string; ellipsis: true }> {
  if (items.length <= maxVisible) return items;
  return [
    items[0]!,
    { key: '__ellipsis__', ellipsis: true as const },
    ...items.slice(-2),
  ];
}

export function AppBreadcrumbs({
  items,
  separator = '/',
  maxVisible = 4,
  className,
}: AppBreadcrumbsProps) {
  if (!items.length) return null;

  const trail = collapseTrail(items, maxVisible);

  return (
    <Breadcrumb className={cn('min-w-0', className)}>
      <BreadcrumbList className="flex-nowrap gap-2 text-[13px] sm:gap-2">
        {trail.map((entry, index) => {
          const isLast = index === trail.length - 1;

          if ('ellipsis' in entry) {
            return (
              <React.Fragment key={entry.key}>
                <BreadcrumbItem>
                  <BreadcrumbEllipsis className="size-3.5" />
                </BreadcrumbItem>
                <BreadcrumbSeparator className="text-muted-foreground/60 [&>svg]:size-3.5">
                  {separator}
                </BreadcrumbSeparator>
              </React.Fragment>
            );
          }

          const isCurrent = isLast || !entry.href;
          return (
            <React.Fragment key={entry.key}>
              <BreadcrumbItem className="whitespace-nowrap">
                {isCurrent ? (
                  <BreadcrumbPage className="font-semibold">
                    {entry.label}
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink href={entry.href}>
                    {entry.label}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!isLast ? (
                <BreadcrumbSeparator className="text-muted-foreground/60 [&>svg]:size-3.5">
                  {separator}
                </BreadcrumbSeparator>
              ) : null}
            </React.Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
