/* ============================================================
   DataCard — a titled card that wraps a table/list surface with a
   record count in its description. Server-safe; shared by the Step 8
   sub-surface pages (transport routes/pickups, library loans, hr
   directory) so they read consistently.
   ============================================================ */

import * as React from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card';

interface DataCardProps {
  title: string;
  /** Row count, pluralized against `unit` in the description. */
  count: number;
  unit: string;
  description?: string;
  /** Optional header-right slot (e.g. a primary action button). */
  action?: React.ReactNode;
  children: React.ReactNode;
}

export function DataCard({
  title,
  count,
  unit,
  description,
  action,
  children,
}: DataCardProps) {
  const label =
    description ?? `${count} ${unit}${count === 1 ? '' : 's'}`;
  return (
    <Card className="@container/data-card shadow-card">
      <CardHeader className="flex-col items-start justify-between gap-3 space-y-0 @xs/data-card:flex-row @xs/data-card:items-center">
        <div className="flex min-w-0 flex-col gap-1.5">
          <CardTitle className="text-base">{title}</CardTitle>
          <CardDescription>{label}</CardDescription>
        </div>
        {action ? <div className="shrink-0 self-start">{action}</div> : null}
      </CardHeader>
      {/* Table goes edge-to-edge (px-0) and its outer cells re-inset to the
          responsive Card gutter, so the table aligns with the header and
          matches every DataTableLayout table. */}
      <CardContent
        className={
          count > 0
            ? 'px-0 [&_:is(th,td):first-child]:pl-4 [&_:is(th,td):last-child]:pr-4 sm:[&_:is(th,td):first-child]:pl-6 sm:[&_:is(th,td):last-child]:pr-6'
            : undefined
        }
      >
        {children}
      </CardContent>
    </Card>
  );
}
