'use client';

import { Bus, CalendarDays, MapPin, Users } from 'lucide-react';
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
    key: 'routes',
    label: 'Transport routes',
    href: '/transport/routes',
    icon: <Bus />,
  },
  {
    key: 'pickups',
    label: 'Pickup register',
    href: '/transport/pickups',
    icon: <MapPin />,
  },
  {
    key: 'events',
    label: 'School events',
    href: '/events/upcoming',
    icon: <CalendarDays />,
  },
];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function OperationsDashboard({ userName }: { userName: string }) {
  const { stats, loading } = useOverviewStats();
  const s = stats?.school;

  const STATS: StatItem[] = [
    {
      key: 'events',
      label: 'Upcoming events',
      value: loading ? '—' : formatCount(s?.upcomingEvents ?? 0),
      icon: <CalendarDays />,
      href: '/events/upcoming',
    },
    {
      key: 'students',
      label: 'Students',
      value: loading ? '—' : formatCount(s?.students ?? 0),
      icon: <MapPin />,
      href: '/students/directory',
    },
    {
      key: 'classes',
      label: 'Classes',
      value: loading ? '—' : formatCount(s?.classes ?? 0),
      icon: <Users />,
      href: '/classes/timetable',
    },
  ];

  return (
    <ShellMain>
      <DashboardLayout
        header={
          <PageHeader
            title={`${greeting()}, ${userName}`}
            meta={[{ key: 'role', label: 'Operations', emphasis: true }]}
          />
        }
        stats={<StatGrid items={STATS} minTileWidth={170} />}
        aside={
          <DashboardQuickActions
            actions={QUICK_ACTIONS}
            description="Operations tasks"
          />
        }
      >
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-base">Transport</CardTitle>
            <CardDescription>Routes and pickups for this school</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="rounded-[var(--radius-sm)] border border-dashed border-border p-4 text-sm text-muted-foreground">
              Manage transport routes and the daily pickup register.
            </p>
            <div className="mt-3 flex gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href="/transport/routes">Routes</Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href="/events/upcoming">Events</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </DashboardLayout>
    </ShellMain>
  );
}
