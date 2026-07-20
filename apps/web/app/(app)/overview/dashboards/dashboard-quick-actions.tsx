import type * as React from 'react';
import Link from 'next/link';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card';

export interface DashboardQuickAction {
  key: string;
  label: string;
  href: string;
  icon: React.ReactNode;
}

export function preferredQuickActionColumns(actionCount: number): 1 | 2 | 3 {
  if (actionCount <= 1) return 1;
  if (actionCount === 2 || actionCount === 4) return 2;
  return 3;
}

function quickActionGridClass(columns: 1 | 2 | 3): string {
  if (columns === 1) return 'grid-cols-1';
  if (columns === 2) {
    return 'grid-cols-1 @xs/quick-actions:grid-cols-2';
  }
  return 'grid-cols-1 @xs/quick-actions:grid-cols-2 @md/quick-actions:grid-cols-3';
}

export function DashboardQuickActions({
  actions,
  description = 'Common tasks for your role',
}: {
  actions: DashboardQuickAction[];
  description?: string;
}) {
  const preferredColumns = preferredQuickActionColumns(actions.length);

  return (
    <Card className="@container/quick-actions shadow-card">
      <CardHeader>
        <CardTitle className="text-base">Quick actions</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent
        data-slot="dashboard-quick-actions-grid"
        data-preferred-columns={preferredColumns}
        className={`grid gap-2 ${quickActionGridClass(preferredColumns)}`}
      >
        {actions.map((action) => (
          <Link
            key={action.key}
            href={action.href}
            className="flex min-h-12 min-w-0 items-center gap-2 rounded-[var(--radius-sm)] border border-border bg-card px-2.5 py-2 text-left text-[13px] font-semibold leading-tight text-foreground outline-none transition-colors hover:border-ring/60 hover:bg-accent/40 focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <span
              className="grid size-7 shrink-0 place-items-center rounded-[var(--radius-sm)] bg-muted text-muted-foreground [&>svg]:size-4"
              aria-hidden
            >
              {action.icon}
            </span>
            <span className="min-w-0 break-words">{action.label}</span>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
