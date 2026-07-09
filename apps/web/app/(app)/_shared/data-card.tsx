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
  children: React.ReactNode;
}

export function DataCard({
  title,
  count,
  unit,
  description,
  children,
}: DataCardProps) {
  const label =
    description ?? `${count} ${unit}${count === 1 ? '' : 's'}`;
  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{label}</CardDescription>
      </CardHeader>
      <CardContent className={count > 0 ? 'px-0' : undefined}>
        {children}
      </CardContent>
    </Card>
  );
}
