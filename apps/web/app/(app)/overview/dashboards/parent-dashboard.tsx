'use client';

/* ============================================================
   ParentDashboard — real, guardian-scoped multi-child view

   Fetches the signed-in parent's own children from
   GET /api/parent-portal/children (backed by real StudentGuardian +
   AttendanceRecord + Grade + FeeInvoice data — no mock numbers). A
   child with no recorded attendance/grades yet correctly shows an
   empty state rather than a fabricated figure.

   A parent with more than one child gets a roster where each card is
   itself the selector — clicking a child filters the stats/fee
   statement to them, with an "All children" pill in the same row
   aggregating averages/sums across the roster. No separate dropdown
   floating above the list it duplicates: the thing you click is the
   thing that changes. A parent with exactly one child skips the
   selector row entirely (nothing to switch between).
   ============================================================ */

import * as React from 'react';
import { Banknote, BookOpen, CalendarDays, MessageSquare, Users } from 'lucide-react';

import { cn } from '@workspace/ui/lib/utils';
import { Button } from '@workspace/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card';
import { PageHeader } from '@workspace/ui/custom/shell/page-header';
import { ShellMain } from '@workspace/ui/custom/shell/app-shell';
import { DashboardLayout } from '@workspace/ui/custom/layouts/dashboard-layout';
import { StatGrid } from '@workspace/ui/custom/layouts/stat-grid';
import type { StatItem } from '@workspace/ui/types/layout.types';

interface ChildSummary {
  studentId: string;
  firstName: string;
  lastName: string;
  initials: string;
  gradeLevel: string | null;
  attendancePercent: number | null;
  averageGradePercent: number | null;
  feeTotalDue: number;
  feeTotalPaid: number;
  feeBalance: number;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatNaira(minorUnits: number) {
  return `₦${(minorUnits / 100).toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;
}

/** Averages non-null percentages across children; null when none have data yet. */
function averagePercent(values: Array<number | null>): number | null {
  const present = values.filter((v): v is number => v !== null);
  if (present.length === 0) return null;
  return Math.round(present.reduce((sum, v) => sum + v, 0) / present.length);
}

interface Props { userName: string; schoolName: string }

export function ParentDashboard({ userName, schoolName }: Props) {
  const [children, setChildren] = React.useState<ChildSummary[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedId, setSelectedId] = React.useState<string>('all');

  React.useEffect(() => {
    let cancelled = false;
    fetch('/api/parent-portal/children')
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error) {
          setError(data.error);
          return;
        }
        setChildren(data.children ?? []);
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load children');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selected =
    selectedId !== 'all' ? children?.find((c) => c.studentId === selectedId) : undefined;

  const view = React.useMemo(() => {
    if (!children || children.length === 0) return null;

    if (selected) {
      return {
        label: `${selected.firstName} ${selected.lastName}`,
        subLabel: selected.gradeLevel ?? undefined,
        attendancePercent: selected.attendancePercent,
        averageGradePercent: selected.averageGradePercent,
        feeTotalDue: selected.feeTotalDue,
        feeTotalPaid: selected.feeTotalPaid,
        feeBalance: selected.feeBalance,
      };
    }

    // Aggregate across all children
    return {
      label: children.length === 1 ? `${children[0]!.firstName} ${children[0]!.lastName}` : 'All children',
      subLabel: children.length > 1 ? `${children.length} children` : (children[0]?.gradeLevel ?? undefined),
      attendancePercent: averagePercent(children.map((c) => c.attendancePercent)),
      averageGradePercent: averagePercent(children.map((c) => c.averageGradePercent)),
      feeTotalDue: children.reduce((sum, c) => sum + c.feeTotalDue, 0),
      feeTotalPaid: children.reduce((sum, c) => sum + c.feeTotalPaid, 0),
      feeBalance: children.reduce((sum, c) => sum + c.feeBalance, 0),
    };
  }, [children, selected]);

  const stats: StatItem[] = view
    ? [
        {
          key: 'attendance',
          label: "Attendance",
          value: view.attendancePercent !== null ? `${view.attendancePercent}%` : '—',
          icon: <CalendarDays />,
        },
        {
          key: 'average',
          label: 'Average grade',
          value: view.averageGradePercent !== null ? `${view.averageGradePercent}%` : '—',
          icon: <BookOpen />,
        },
        {
          key: 'fee',
          label: 'Fee balance',
          value: formatNaira(view.feeBalance),
          icon: <Banknote />,
          ...(view.feeBalance > 0 ? { delta: { label: 'Outstanding', direction: 'up' as const, intent: 'negative' as const } } : {}),
        },
      ]
    : [];

  return (
    <ShellMain>
      <DashboardLayout
        header={
          <PageHeader
            title={`${greeting()}, ${userName}`}
            meta={
              view
                ? [
                    { key: 'child', label: view.label, emphasis: true },
                    ...(view.subLabel ? [{ key: 'sub', label: view.subLabel }] : []),
                  ]
                : []
            }
            actions={
              <Button size="sm">
                <MessageSquare className="size-4" /> Send message
              </Button>
            }
          />
        }
        stats={<StatGrid items={stats} />}
        aside={
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="size-4" /> Children
              </CardTitle>
              <CardDescription>{schoolName}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {error ? (
                <p className="text-sm text-destructive">{error}</p>
              ) : children === null ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : children.length === 0 ? (
                <p className="text-sm text-muted-foreground">No children linked to this profile yet.</p>
              ) : (
                <>
                  {children.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => setSelectedId('all')}
                      aria-pressed={selectedId === 'all'}
                      className={cn(
                        'flex items-center gap-2.5 rounded-[var(--radius-sm)] border p-2.5 text-left outline-none transition-colors',
                        'focus-visible:ring-[3px] focus-visible:ring-ring/50',
                        selectedId === 'all'
                          ? 'border-primary bg-primary/5'
                          : 'border-border bg-card hover:bg-accent',
                      )}
                    >
                      <span className="grid size-7 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                        <Users className="size-3.5" />
                      </span>
                      <span className="text-sm font-medium text-foreground">All children</span>
                    </button>
                  ) : null}
                  {children.map((c) => {
                    const isActive = selectedId === c.studentId;
                    return (
                      <button
                        key={c.studentId}
                        type="button"
                        onClick={() => setSelectedId(c.studentId)}
                        aria-pressed={isActive}
                        className={cn(
                          'flex items-center gap-2.5 rounded-[var(--radius-sm)] border p-2.5 text-left outline-none transition-colors',
                          'focus-visible:ring-[3px] focus-visible:ring-ring/50',
                          isActive
                            ? 'border-primary bg-primary/5'
                            : 'border-border bg-card hover:bg-accent',
                        )}
                      >
                        <span className="grid size-7 shrink-0 place-items-center rounded-md bg-primary/10 text-[11px] font-bold text-primary">
                          {c.initials}
                        </span>
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate text-sm font-medium text-foreground">
                            {c.firstName} {c.lastName}
                          </span>
                          <span className="text-xs text-muted-foreground">{c.gradeLevel ?? '—'}</span>
                        </div>
                      </button>
                    );
                  })}
                </>
              )}
            </CardContent>
          </Card>
        }
      >
        <Card className="flex-1 shadow-card">
          <CardHeader>
            <CardTitle className="text-base">Fee statement</CardTitle>
            <CardDescription>{view?.label ?? 'No children'}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {view ? (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total billed</span>
                  <span className="font-medium">{formatNaira(view.feeTotalDue)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Paid</span>
                  <span className="font-medium text-success">{formatNaira(view.feeTotalPaid)}</span>
                </div>
                <div className="h-px bg-border" />
                <div className="flex justify-between text-sm">
                  <span className="font-semibold">Balance</span>
                  <span className="font-bold text-destructive">{formatNaira(view.feeBalance)}</span>
                </div>
                {view.feeTotalDue > 0 ? (
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-success"
                      style={{ width: `${Math.min(100, Math.round((view.feeTotalPaid / view.feeTotalDue) * 100))}%` }}
                    />
                  </div>
                ) : null}
                {view.feeBalance > 0 ? (
                  <Button className="mt-1 w-full" size="sm">Pay balance</Button>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No billing records yet.</p>
            )}
          </CardContent>
        </Card>
      </DashboardLayout>
    </ShellMain>
  );
}
