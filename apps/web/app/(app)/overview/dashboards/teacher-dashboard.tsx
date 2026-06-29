'use client';

import { BookOpen, CalendarDays, CheckCircle, ClipboardList, Users } from 'lucide-react';
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
  { key: 'classes', label: 'My classes', value: '4', icon: <BookOpen />, href: '/classes/timetable' },
  { key: 'students', label: 'My students', value: '148', icon: <Users />, href: '/students/directory' },
  { key: 'attendance', label: 'Avg attendance', value: '91%', icon: <CalendarDays /> },
  { key: 'pending', label: 'Pending grades', value: '12', icon: <ClipboardList />, delta: { label: 'Due Friday', direction: 'up', intent: 'negative' }, href: '/classes/gradebook' },
];

const MY_CLASSES = [
  { key: 'c1', name: 'JSS 2A · Mathematics', time: '8:00 – 8:45 AM', done: true },
  { key: 'c2', name: 'SS 1B · Further Maths', time: '9:00 – 9:45 AM', done: true },
  { key: 'c3', name: 'JSS 3C · Mathematics', time: '11:00 – 11:45 AM', done: false },
  { key: 'c4', name: 'SS 2A · Mathematics', time: '2:00 – 2:45 PM', done: false },
];

const UPCOMING = [
  { key: 'u1', text: 'Submit JSS 2A mid-term grades', when: 'Due Friday' },
  { key: 'u2', text: 'SS 1B test — Functions & Limits', when: 'Next Monday' },
  { key: 'u3', text: 'Staff meeting', when: 'Wednesday, 3 PM' },
];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

interface Props { userName: string }

export function TeacherDashboard({ userName }: Props) {
  return (
    <ShellMain>
      <DashboardLayout
        header={
          <PageHeader
            title={`${greeting()}, ${userName}`}
            meta={[
              { key: 'term', label: 'Spring Term 2025', emphasis: true },
              { key: 'day', label: 'Week 6 · Wednesday' },
            ]}
            actions={
              <>
                <Button variant="outline" size="sm" className="max-md:hidden" asChild>
                  <Link href="/classes/gradebook">Gradebook</Link>
                </Button>
                <Button size="sm" asChild>
                  <Link href="/attendance/daily"><CalendarDays className="size-4" /> Take attendance</Link>
                </Button>
              </>
            }
          />
        }
        stats={<StatGrid items={STATS} />}
        aside={
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-base">Upcoming</CardTitle>
              <CardDescription>Tasks &amp; events this week</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {UPCOMING.map((u) => (
                <div key={u.key} className="flex items-start justify-between gap-3">
                  <span className="text-sm text-foreground">{u.text}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{u.when}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        }
      >
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-base">Today&apos;s classes</CardTitle>
            <CardDescription>Wednesday · {new Date().toLocaleDateString('en-NG', { day: 'numeric', month: 'long' })}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {MY_CLASSES.map((cls) => (
              <div
                key={cls.key}
                className="flex items-center gap-3 rounded-[var(--radius-sm)] border border-border bg-card p-3"
              >
                <span className={cls.done ? 'grid size-7 shrink-0 place-items-center rounded-full bg-success/15 text-success' : 'grid size-7 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground'}>
                  <CheckCircle className="size-4" />
                </span>
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-semibold text-foreground">{cls.name}</span>
                  <span className="text-xs text-muted-foreground">{cls.time}</span>
                </div>
                {!cls.done && (
                  <Button variant="outline" size="sm" className="ml-auto shrink-0 text-xs" asChild>
                    <Link href="/attendance/daily">Mark</Link>
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="flex-1 shadow-card">
          <CardHeader>
            <CardTitle className="text-base">Quick actions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Button variant="outline" className="justify-start gap-2" asChild>
              <Link href="/attendance/daily"><CalendarDays className="size-4" /> Daily attendance register</Link>
            </Button>
            <Button variant="outline" className="justify-start gap-2" asChild>
              <Link href="/classes/gradebook"><BookOpen className="size-4" /> Enter grades</Link>
            </Button>
            <Button variant="outline" className="justify-start gap-2" asChild>
              <Link href="/classes/timetable"><ClipboardList className="size-4" /> View timetable</Link>
            </Button>
          </CardContent>
        </Card>
      </DashboardLayout>
    </ShellMain>
  );
}
