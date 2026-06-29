'use client';

import { Bus, CalendarDays, Hammer, MapPin } from 'lucide-react';
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

const STATS: StatItem[] = [
  { key: 'routes', label: 'Transport routes', value: '8', icon: <Bus /> },
  { key: 'students', label: 'Students on bus', value: '340', icon: <MapPin /> },
  { key: 'events', label: 'Upcoming events', value: '3', icon: <CalendarDays />, href: '/classes/timetable' },
  { key: 'maintenance', label: 'Open work orders', value: '2', icon: <Hammer />, delta: { label: 'Pending action', direction: 'up', intent: 'negative' } },
];

const UPCOMING_EVENTS = [
  { key: 'e1', title: 'Cultural day setup', date: '12 July', status: 'Planning' },
  { key: 'e2', title: 'Bus route 3 maintenance', date: '15 July', status: 'Scheduled' },
  { key: 'e3', title: 'Term-end logistics', date: '25 July', status: 'Planning' },
];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

interface Props { userName: string }

export function OperationsDashboard({ userName }: Props) {
  return (
    <ShellMain>
      <DashboardLayout
        header={
          <PageHeader
            title={`${greeting()}, ${userName}`}
            meta={[
              { key: 'role', label: 'Operations', emphasis: true },
              { key: 'term', label: 'Spring Term 2025' },
            ]}
          />
        }
        stats={<StatGrid items={STATS} />}
        aside={
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-base">Upcoming events</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {UPCOMING_EVENTS.map((e) => (
                <div key={e.key} className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium text-foreground">{e.title}</span>
                    <span className="text-xs text-muted-foreground">{e.date}</span>
                  </div>
                  <span className="shrink-0 rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">{e.status}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        }
      >
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-base">Transport routes</CardTitle>
            <CardDescription>8 active routes · 340 students</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {[
              { key: 'r1', route: 'Route 1 — Ikorodu', students: 48, status: 'On time' },
              { key: 'r2', route: 'Route 2 — Yaba', students: 52, status: 'On time' },
              { key: 'r3', route: 'Route 3 — Surulere', students: 41, status: 'Delayed 10 min' },
              { key: 'r4', route: 'Route 4 — Oshodi', students: 38, status: 'On time' },
            ].map((r) => (
              <div key={r.key} className="flex items-center justify-between rounded-[var(--radius-sm)] border border-border p-3">
                <div className="flex min-w-0 flex-col">
                  <span className="text-sm font-medium text-foreground">{r.route}</span>
                  <span className="text-xs text-muted-foreground">{r.students} students</span>
                </div>
                <span className={r.status === 'On time' ? 'text-xs font-medium text-success' : 'text-xs font-medium text-warning'}>
                  {r.status}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="flex-1 shadow-card">
          <CardHeader>
            <CardTitle className="text-base">More modules coming soon</CardTitle>
            <CardDescription>Facilities, HR, inventory, and safety management</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Transport tracking, facilities scheduling, inventory management,
              and HR modules are on the product roadmap. Check back soon.
            </p>
            <Button variant="outline" size="sm" className="mt-4" asChild>
              <Link href="/classes/timetable">View class schedules</Link>
            </Button>
          </CardContent>
        </Card>
      </DashboardLayout>
    </ShellMain>
  );
}
