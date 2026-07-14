'use client';

import { Banknote, CircleAlert, CreditCard, TrendingUp } from 'lucide-react';
import Link from 'next/link';

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

import { DashboardQuickActions } from './dashboard-quick-actions';
import { RefreshButton } from '../../_shared/refresh-button';
import {
  formatCount,
  formatNaira,
  useOverviewStats,
} from '../use-overview-stats';

const QUICK_ACTIONS = [
  {
    key: 'payment',
    label: 'Record payment',
    href: '/finance/payments',
    icon: <Banknote />,
  },
  {
    key: 'invoices',
    label: 'Review invoices',
    href: '/finance/invoices',
    icon: <CreditCard />,
  },
  {
    key: 'reports',
    label: 'Financial reports',
    href: '/finance/reports',
    icon: <TrendingUp />,
  },
];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

interface Props {
  userName: string;
  schoolName: string;
}

export function FinanceDashboard({ userName, schoolName }: Props) {
  const { stats, loading, refreshing, refresh } = useOverviewStats();
  const f = stats?.school.finance;

  const STATS: StatItem[] = [
    {
      key: 'collected',
      label: 'Collected (mo)',
      value: loading ? '—' : formatNaira(f?.revenueThisMonth ?? 0),
      icon: <TrendingUp />,
      href: '/finance/reports',
    },
    {
      key: 'outstanding',
      label: 'Outstanding',
      value: loading ? '—' : formatNaira(f?.outstandingAmount ?? 0),
      icon: <Banknote />,
      href: '/finance/invoices',
    },
    {
      key: 'invoices',
      label: 'Open invoices',
      value: loading ? '—' : formatCount(f?.outstandingInvoices ?? 0),
      icon: <CreditCard />,
      href: '/finance/invoices',
    },
    {
      key: 'students',
      label: 'Students',
      value: loading ? '—' : formatCount(stats?.school.students ?? 0),
      icon: <CircleAlert />,
      href: '/students/directory',
    },
  ];

  return (
    <ShellMain>
      <DashboardLayout
        header={
          <PageHeader
            title={`${greeting()}, ${userName}`}
            meta={[{ key: 'role', label: 'Finance & Billing' }]}
            actions={
              <>
                <RefreshButton onRefresh={refresh} refreshing={refreshing} />
                <Button size="sm" asChild>
                  <Link href="/finance/payments">
                    <Banknote className="size-4" /> Record payment
                  </Link>
                </Button>
              </>
            }
          />
        }
        stats={<StatGrid items={STATS} />}
        aside={
          <DashboardQuickActions
            actions={QUICK_ACTIONS}
            description="Finance and billing tasks"
          />
        }
      >
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CircleAlert className="size-4 text-destructive" aria-hidden />
              Outstanding fees
            </CardTitle>
            <CardDescription>Across {schoolName}</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (f?.outstandingInvoices ?? 0) === 0 ? (
              <p className="rounded-[var(--radius-sm)] border border-dashed border-border p-4 text-sm text-muted-foreground">
                No outstanding invoices. Once fees are billed, overdue accounts
                appear here.
              </p>
            ) : (
              <div className="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-border bg-card p-3">
                <div className="flex min-w-0 flex-col">
                  <span className="text-sm font-semibold text-foreground">
                    {formatCount(f?.outstandingInvoices ?? 0)} open invoice
                    {(f?.outstandingInvoices ?? 0) === 1 ? '' : 's'}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Awaiting payment
                  </span>
                </div>
                <span className="shrink-0 text-sm font-semibold text-foreground">
                  {formatNaira(f?.outstandingAmount ?? 0)}
                </span>
              </div>
            )}
            <Button variant="outline" size="sm" className="mt-3" asChild>
              <Link href="/finance/invoices">Go to invoices</Link>
            </Button>
          </CardContent>
        </Card>
      </DashboardLayout>
    </ShellMain>
  );
}
