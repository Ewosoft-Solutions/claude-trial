/* ============================================================
   AppBreadcrumbs — data-driven breadcrumb trail (top bar)

   Wraps the shared breadcrumb primitive so the shell can render
   a typed `BreadcrumbEntry[]`. The last entry (or any entry
   without an `href`) renders as the current page.
   ============================================================ */

import * as React from 'react';

import { cn } from '@workspace/ui/lib/utils';
import {
  Breadcrumb,
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
  className?: string;
}

export function AppBreadcrumbs({
  items,
  separator = '/',
  className,
}: AppBreadcrumbsProps) {
  if (!items.length) return null;

  return (
    <Breadcrumb className={cn('min-w-0', className)}>
      <BreadcrumbList className="flex-nowrap gap-2 text-[13px] sm:gap-2">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          const isCurrent = isLast || !item.href;
          return (
            <React.Fragment key={item.key}>
              <BreadcrumbItem className="whitespace-nowrap">
                {isCurrent ? (
                  <BreadcrumbPage className="font-semibold">
                    {item.label}
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink href={item.href}>
                    {item.label}
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
