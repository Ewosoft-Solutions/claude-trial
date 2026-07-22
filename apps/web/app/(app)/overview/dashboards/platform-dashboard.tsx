'use client';

/* ============================================================
   Platform overview — the platform-scope landing dashboard.

   Rendered by /overview when viewer.scope === 'platform'. Shows the
   honest tenant-health cut (docs/platform-scope-plan.md §3): what the
   current schema actually supports. MRR / renewals / tickets are
   omitted rather than shown as zeroes — they arrive with billing and
   support.
   ============================================================ */

import Link from 'next/link';
import useSWR from 'swr';
import {
  Building2,
  ClipboardCheck,
  Clock,
  Layers,
  Plus,
  Users,
} from 'lucide-react';
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
import { RefreshButton } from '../../_shared/refresh-button';

interface PlatformOverview {
  tenants: { total: number; active: number; pending: number; suspended: number };
  byType: { schoolType: string; count: number }[];
  users: { total: number };
  onboarding: {
    stalled: {
      id: string;
      name: string;
      slug: string;
      daysWaiting: number;
    }[];
  };
  growth: { month: string; count: number }[];
  recentActivity: { action: string; targetTenantId: string | null; at: string }[];
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatCount(n: number): string {
  return new Intl.NumberFormat().format(n);
}

function titleCase(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

const ACTION_LABELS: Record<string, string> = {
  tenant_registered: 'School registered',
  tenant_status_updated: 'Status changed',
  platform_tenant_status_action: 'Status changed (platform)',
};

interface Props {
  userName: string;
}

export function PlatformDashboard({ userName }: Props) {
  const {
    data,
    isLoading: loading,
    isValidating: refreshing,
    mutate,
  } = useSWR<PlatformOverview>('/api/platform/overview');

  const t = data?.tenants;

  const STATS: StatItem[] = [
    {
      key: 'total',
      label: 'Total schools',
      value: loading ? '—' : formatCount(t?.total ?? 0),
      icon: <Building2 />,
      href: '/platform/tenants/all',
    },
    {
      key: 'active',
      label: 'Active schools',
      value: loading ? '—' : formatCount(t?.active ?? 0),
      icon: <Building2 />,
      href: '/platform/tenants/all',
    },
    {
      key: 'pending',
      label: 'Pending / onboarding',
      value: loading ? '—' : formatCount(t?.pending ?? 0),
      icon: <Clock />,
      href: '/platform/tenants/all',
    },
    {
      key: 'users',
      label: 'Total users',
      value: loading ? '—' : formatCount(data?.users.total ?? 0),
      icon: <Users />,
    },
  ];

  const stalled = data?.onboarding.stalled ?? [];
  const peakGrowth = Math.max(1, ...(data?.growth ?? []).map((g) => g.count));

  return (
    <ShellMain>
      <DashboardLayout
        header={
          <PageHeader
            title={`${greeting()}, ${userName}`}
            description="Platform overview — all schools"
            actions={
              <>
                <RefreshButton onRefresh={() => void mutate()} refreshing={refreshing} />
                <Button size="sm" asChild>
                  <Link href="/platform/tenants/onboarding">
                    <Plus /> Onboard school
                  </Link>
                </Button>
              </>
            }
          />
        }
        stats={<StatGrid items={STATS} />}
        aside={
          <>
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="text-base">Quick actions</CardTitle>
                <CardDescription>Platform management</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <QuickLink href="/platform/tenants/all" icon={<Building2 className="size-4" />} label="All schools" />
                <QuickLink href="/platform/tenants/onboarding" icon={<Plus className="size-4" />} label="Onboard a school" />
                <QuickLink href="/platform/tenants/approvals" icon={<ClipboardCheck className="size-4" />} label="Review approvals" />
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Layers className="size-4" aria-hidden /> By institution type
                </CardTitle>
                <CardDescription>Distribution across the platform</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 text-sm">
                {loading ? (
                  <p className="text-muted-foreground">Loading…</p>
                ) : (data?.byType.length ?? 0) === 0 ? (
                  <p className="text-muted-foreground">No schools yet.</p>
                ) : (
                  data?.byType.map((row) => (
                    <div key={row.schoolType} className="flex items-center justify-between">
                      <span className="capitalize text-muted-foreground">
                        {titleCase(row.schoolType)}
                      </span>
                      <span className="font-medium text-foreground">
                        {formatCount(row.count)}
                      </span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </>
        }
      >
        {/* Needs attention: stalled onboarding */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="size-4 text-warning" aria-hidden />
              Needs attention
            </CardTitle>
            <CardDescription>
              Schools stalled in onboarding (14+ days pending)
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : stalled.length === 0 ? (
              <p className="rounded-[var(--radius-sm)] border border-dashed border-border p-4 text-sm text-muted-foreground">
                Nothing stalled — every pending school is fresh.
              </p>
            ) : (
              stalled.map((s) => (
                <Link
                  key={s.id}
                  href="/platform/tenants/all"
                  className="flex items-center justify-between rounded-[var(--radius-sm)] border border-border bg-card p-3 text-sm transition-colors hover:border-ring/60 hover:bg-accent/40"
                >
                  <span className="font-medium">{s.name}</span>
                  <span className="text-muted-foreground">
                    {s.daysWaiting} days waiting
                  </span>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        {/* Growth — simple 12-month bar strip */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-base">School growth</CardTitle>
            <CardDescription>New schools per month (last 12)</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (
              <div className="flex items-end gap-1" style={{ height: 96 }}>
                {data?.growth.map((g) => (
                  <div
                    key={g.month}
                    className="flex-1"
                    title={`${g.month}: ${g.count}`}
                  >
                    <div
                      className="rounded-t-sm bg-primary/70"
                      style={{
                        height: `${Math.round((g.count / peakGrowth) * 88)}px`,
                        minHeight: g.count > 0 ? 4 : 1,
                      }}
                    />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent activity */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-base">Recent activity</CardTitle>
            <CardDescription>Latest tenant-lifecycle events</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {loading ? (
              <p className="text-muted-foreground">Loading…</p>
            ) : (data?.recentActivity.length ?? 0) === 0 ? (
              <p className="text-muted-foreground">No recent activity.</p>
            ) : (
              data?.recentActivity.map((a, i) => (
                <div
                  key={`${a.targetTenantId}-${i}`}
                  className="flex items-center justify-between"
                >
                  <span>{ACTION_LABELS[a.action] ?? titleCase(a.action)}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(a.at).toLocaleDateString()}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </DashboardLayout>
    </ShellMain>
  );
}

function QuickLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 rounded-[var(--radius-sm)] border border-border bg-card p-2.5 text-sm transition-colors hover:border-ring/60 hover:bg-accent/40"
    >
      <span className="grid size-7 place-items-center rounded-md bg-primary/10 text-primary">
        {icon}
      </span>
      {label}
    </Link>
  );
}
