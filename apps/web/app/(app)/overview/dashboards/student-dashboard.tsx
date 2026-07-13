'use client';

import { BookOpen, CalendarDays, CheckCircle2, Clock } from 'lucide-react';
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
import { formatCount, useOverviewStats } from '../use-overview-stats';

const QUICK_ACTIONS = [
  {
    key: 'timetable',
    label: 'View timetable',
    href: '/classes/timetable',
    icon: <Clock />,
  },
  {
    key: 'materials',
    label: 'Study materials',
    href: '/classes/materials',
    icon: <BookOpen />,
  },
  {
    key: 'assessments',
    label: 'Take assessment',
    href: '/classes/assessments',
    icon: <CheckCircle2 />,
  },
];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function StudentDashboard({ userName }: { userName: string }) {
  const { stats, loading } = useOverviewStats();

  const STATS: StatItem[] = [
    {
      key: 'classes',
      label: 'My classes',
      value: loading ? '—' : formatCount(stats?.personal.myEnrollments ?? 0),
      icon: <BookOpen />,
      href: '/classes/timetable',
    },
    {
      key: 'events',
      label: 'Upcoming events',
      value: loading ? '—' : formatCount(stats?.school.upcomingEvents ?? 0),
      icon: <Clock />,
      href: '/events/upcoming',
    },
    {
      key: 'attendance',
      label: 'School attendance',
      value: loading
        ? '—'
        : stats?.school.attendanceRate == null
          ? 'n/a'
          : `${stats.school.attendanceRate}%`,
      icon: <CalendarDays />,
    },
  ];

  const noClasses = !loading && (stats?.personal.myEnrollments ?? 0) === 0;

  return (
    <ShellMain>
      <DashboardLayout
        header={<PageHeader title={`${greeting()}, ${userName}`} />}
        stats={<StatGrid items={STATS} minTileWidth={140} />}
        aside={
          <DashboardQuickActions
            actions={QUICK_ACTIONS}
            description="Learning tasks"
          />
        }
      >
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-base">My classes</CardTitle>
            <CardDescription>Your current enrolments</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : noClasses ? (
              <p className="rounded-[var(--radius-sm)] border border-dashed border-border p-4 text-sm text-muted-foreground">
                You aren&apos;t enrolled in any classes yet. Once you&apos;re
                enrolled, your timetable and grades will appear here.
              </p>
            ) : (
              <p className="text-sm text-foreground">
                You&apos;re enrolled in{' '}
                {formatCount(stats?.personal.myEnrollments ?? 0)} class
                {(stats?.personal.myEnrollments ?? 0) === 1 ? '' : 'es'}.{' '}
                <Link className="underline" href="/classes/timetable">
                  View timetable
                </Link>
                .
              </p>
            )}
          </CardContent>
        </Card>
      </DashboardLayout>
    </ShellMain>
  );
}
