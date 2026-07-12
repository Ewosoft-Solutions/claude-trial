'use client';

/* ============================================================
   DashboardLayout — overview surface scaffold

   The Aurora role-dashboard shape: a page header, an optional KPI
   stat row, then a responsive content region with a primary column
   and an optional aside column (quick actions / activity). Pure
   composition — slots only, no embedded copy. On < lg the aside
   leads the main column so role actions remain visible at a glance.
   ============================================================ */

import * as React from 'react';

import { cn } from '@workspace/ui/lib/utils';

export interface DashboardLayoutProps {
  /** Page header slot, typically <PageHeader/>. */
  header?: React.ReactNode;
  /** KPI row slot, typically <StatGrid/>. */
  stats?: React.ReactNode;
  /** Primary content column (cards, charts, lists). */
  children: React.ReactNode;
  /** Optional secondary column (quick actions, activity feed). */
  aside?: React.ReactNode;
  className?: string;
}

export function DashboardLayout({
  header,
  stats,
  children,
  aside,
  className,
}: DashboardLayoutProps) {
  return (
    <div
      data-slot="dashboard-layout"
      className={cn('flex w-full flex-col gap-5', className)}
    >
      {header}
      {stats}
      {aside ? (
        <div className="grid grid-cols-1 gap-5 @5xl/main:grid-cols-3">
          <div className="order-2 flex flex-col gap-5 @5xl/main:order-1 @5xl/main:col-span-2">
            {children}
          </div>
          <aside className="order-1 flex flex-col gap-5 @5xl/main:order-2 @5xl/main:col-span-1">
            {aside}
          </aside>
        </div>
      ) : (
        <div className="flex flex-col gap-5">{children}</div>
      )}
    </div>
  );
}
