'use client';

import { BookOpen, CalendarClock, ClipboardList, Users } from 'lucide-react';
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
    key: 'attendance',
    label: 'Take attendance',
    href: '/attendance/daily',
    icon: <ClipboardList />,
  },
  {
    key: 'materials',
    label: 'Lesson materials',
    href: '/classes/materials',
    icon: <BookOpen />,
  },
  {
    key: 'gradebook',
    label: 'Gradebook',
    href: '/classes/gradebook',
    icon: <Users />,
  },
];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function TeacherDashboard({ userName }: { userName: string }) {
  const { stats, loading } = useOverviewStats();

  const STATS: StatItem[] = [
    {
      key: 'classes',
      label: 'My classes',
      value: loading ? '—' : formatCount(stats?.personal.myClasses ?? 0),
      icon: <BookOpen />,
      href: '/classes/teachers',
    },
    {
      key: 'students',
      label: 'Students',
      value: loading ? '—' : formatCount(stats?.school.students ?? 0),
      icon: <Users />,
      href: '/students/directory',
    },
    {
      key: 'attendance',
      label: 'Attendance rate',
      value: loading
        ? '—'
        : stats?.school.attendanceRate == null
          ? 'n/a'
          : `${stats.school.attendanceRate}%`,
      icon: <ClipboardList />,
    },
    {
      key: 'events',
      label: 'Upcoming events',
      value: loading ? '—' : formatCount(stats?.school.upcomingEvents ?? 0),
      icon: <CalendarClock />,
      href: '/events/upcoming',
    },
  ];

  const noClasses = !loading && (stats?.personal.myClasses ?? 0) === 0;

  return (
    <ShellMain>
      <DashboardLayout
        header={
          <PageHeader
            title={`${greeting()}, ${userName}`}
            meta={[{ key: 'role', label: 'Teaching' }]}
            actions={
              <Button size="sm" asChild>
                <Link href="/attendance/daily">
                  <ClipboardList className="size-4" /> Take attendance
                </Link>
              </Button>
            }
          />
        }
        stats={<StatGrid items={STATS} minTileWidth={140} />}
        aside={
          <DashboardQuickActions
            actions={QUICK_ACTIONS}
            description="Teaching tasks"
          />
        }
      >
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-base">My classes</CardTitle>
            <CardDescription>Classes assigned to you</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : noClasses ? (
              <p className="rounded-[var(--radius-sm)] border border-dashed border-border p-4 text-sm text-muted-foreground">
                You have no class assignments yet. Once an administrator assigns
                you to classes, they&apos;ll appear here.
              </p>
            ) : (
              <p className="text-sm text-foreground">
                You are assigned to{' '}
                {formatCount(stats?.personal.myClasses ?? 0)} class
                {(stats?.personal.myClasses ?? 0) === 1 ? '' : 'es'}.{' '}
                <Link className="underline" href="/classes/teachers">
                  Manage classes
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
