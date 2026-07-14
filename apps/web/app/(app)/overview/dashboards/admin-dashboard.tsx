'use client';

import {
  Banknote,
  CalendarClock,
  GraduationCap,
  Mail,
  TriangleAlert,
  UserPlus,
  Users,
} from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@workspace/ui/components/badge';
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
import { OnboardingChecklist } from '../onboarding-checklist';
import {
  formatCount,
  formatNaira,
  useOverviewStats,
} from '../use-overview-stats';

const QUICK_ACTIONS = [
  {
    key: 'student',
    label: 'Add student',
    href: '/students/enrollment',
    icon: <UserPlus />,
  },
  {
    key: 'invite',
    label: 'Invite staff',
    href: '/settings/users',
    icon: <Users />,
  },
  {
    key: 'reports',
    label: 'View reports',
    href: '/reports/academic',
    icon: <GraduationCap />,
  },
  {
    key: 'fees',
    label: 'Review fees',
    href: '/finance/invoices',
    icon: <Banknote />,
  },
];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

interface AttentionItem {
  key: string;
  title: string;
  meta: string;
  icon: React.ReactNode;
  href: string;
}

interface Props {
  userName: string;
  schoolName: string;
}

export function AdminDashboard({ userName, schoolName }: Props) {
  const { stats, loading, refreshing, refresh } = useOverviewStats();
  const s = stats?.school;

  const STATS: StatItem[] = [
    {
      key: 'students',
      label: 'Total students',
      value: loading ? '—' : formatCount(s?.students ?? 0),
      icon: <Users />,
      href: '/students/directory',
    },
    {
      key: 'staff',
      label: 'Total staff',
      value: loading ? '—' : formatCount(s?.staff ?? 0),
      icon: <GraduationCap />,
      href: '/settings/users',
    },
    {
      key: 'revenue',
      label: 'Revenue (mo)',
      value: loading ? '—' : formatNaira(s?.finance.revenueThisMonth ?? 0),
      icon: <Banknote />,
      href: '/finance/reports',
    },
    {
      key: 'outstanding',
      label: 'Outstanding fees',
      value: loading ? '—' : formatNaira(s?.finance.outstandingAmount ?? 0),
      href: '/finance/invoices',
    },
    {
      key: 'attendance',
      label: 'Attendance rate',
      value: loading
        ? '—'
        : s?.attendanceRate == null
          ? 'n/a'
          : `${s.attendanceRate}%`,
    },
    {
      key: 'events',
      label: 'Upcoming events',
      value: loading ? '—' : formatCount(s?.upcomingEvents ?? 0),
      icon: <CalendarClock />,
      href: '/events/upcoming',
    },
  ];

  const attention: AttentionItem[] = [];
  if (s) {
    if (s.admissionsPending > 0) {
      attention.push({
        key: 'admissions',
        title: `${s.admissionsPending} admission application${s.admissionsPending === 1 ? '' : 's'}`,
        meta: 'Pending review',
        icon: <UserPlus className="size-4" />,
        href: '/students/enrollment',
      });
    }
    if (s.finance.outstandingInvoices > 0) {
      attention.push({
        key: 'fees',
        title: `${formatNaira(s.finance.outstandingAmount)} outstanding fees`,
        meta: `${s.finance.outstandingInvoices} invoice${s.finance.outstandingInvoices === 1 ? '' : 's'}`,
        icon: <Banknote className="size-4" />,
        href: '/finance/invoices',
      });
    }
    if (s.pendingInvitations > 0) {
      attention.push({
        key: 'invites',
        title: `${s.pendingInvitations} pending invitation${s.pendingInvitations === 1 ? '' : 's'}`,
        meta: 'Awaiting acceptance',
        icon: <Mail className="size-4" />,
        href: '/settings/users',
      });
    }
  }

  return (
    <ShellMain>
      <DashboardLayout
        header={
          <PageHeader
            title={`${greeting()}, ${userName}`}
            actions={
              <>
                <RefreshButton onRefresh={refresh} refreshing={refreshing} />
                <Button
                  variant="outline"
                  size="sm"
                  className="max-md:hidden"
                  asChild
                >
                  <Link href="/reports/academic">View reports</Link>
                </Button>
                <Button size="sm" asChild>
                  <Link href="/students/enrollment">
                    <UserPlus /> Add student
                  </Link>
                </Button>
              </>
            }
          />
        }
        stats={<StatGrid items={STATS} />}
        aside={
          <>
            <DashboardQuickActions
              actions={QUICK_ACTIONS}
              description="School management tasks"
            />
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="text-base">School at a glance</CardTitle>
                <CardDescription>{schoolName}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 text-sm">
                <Row label="Classes" value={loading ? '—' : formatCount(s?.classes ?? 0)} />
                <Row label="Staff" value={loading ? '—' : formatCount(s?.staff ?? 0)} />
                <Row
                  label="Announcements"
                  value={loading ? '—' : formatCount(s?.announcements ?? 0)}
                />
                <Row
                  label="Pending invites"
                  value={loading ? '—' : formatCount(s?.pendingInvitations ?? 0)}
                />
              </CardContent>
            </Card>
          </>
        }
      >
        {stats ? <OnboardingChecklist stats={stats} /> : null}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TriangleAlert className="size-4 text-warning" aria-hidden />
              Needs attention
            </CardTitle>
            <CardDescription>Items waiting on you</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : attention.length === 0 ? (
              <p className="rounded-[var(--radius-sm)] border border-dashed border-border p-4 text-sm text-muted-foreground">
                You&apos;re all caught up — nothing needs attention right now.
              </p>
            ) : (
              attention.map((item) => (
                <Link
                  key={item.key}
                  href={item.href}
                  className="flex items-center gap-3 rounded-[var(--radius-sm)] border border-border bg-card p-3 outline-none transition-colors hover:border-ring/60 hover:bg-accent/40 focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <span
                    className="grid size-8 shrink-0 place-items-center rounded-lg bg-warning/15 text-warning"
                    aria-hidden
                  >
                    {item.icon}
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-semibold text-foreground">
                      {item.title}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {item.meta}
                    </span>
                  </span>
                  <Badge variant="outline" className="ml-auto shrink-0">
                    Action
                  </Badge>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </DashboardLayout>
    </ShellMain>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}
