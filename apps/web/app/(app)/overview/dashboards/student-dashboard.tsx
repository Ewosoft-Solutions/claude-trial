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

const STATS: StatItem[] = [
  {
    key: 'attendance',
    label: 'My attendance',
    value: '91%',
    icon: <CalendarDays />,
  },
  {
    key: 'average',
    label: 'Current average',
    value: '74%',
    icon: <BookOpen />,
  },
  { key: 'upcoming', label: 'Upcoming tests', value: '2', icon: <Clock /> },
  {
    key: 'days',
    label: 'Days to term end',
    value: '21',
    icon: <CheckCircle2 />,
  },
];

const SCHEDULE = [
  {
    key: 's1',
    subject: 'Mathematics',
    teacher: 'Mr Okafor',
    time: '8:00 AM',
    room: 'Room 14',
    done: true,
  },
  {
    key: 's2',
    subject: 'English Language',
    teacher: 'Mrs Aluko',
    time: '9:00 AM',
    room: 'Room 14',
    done: true,
  },
  {
    key: 's3',
    subject: 'Basic Science',
    teacher: 'Mr Dike',
    time: '11:00 AM',
    room: 'Lab 2',
    done: false,
  },
  {
    key: 's4',
    subject: 'Social Studies',
    teacher: 'Mrs Nwosu',
    time: '2:00 PM',
    room: 'Room 14',
    done: false,
  },
];

const RECENT_GRADES = [
  { key: 'g1', subject: 'Mathematics', score: '82/100', grade: 'B' },
  { key: 'g2', subject: 'English Language', score: '76/100', grade: 'B' },
  { key: 'g3', subject: 'Basic Science', score: '90/100', grade: 'A' },
];

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
  {
    key: 'attendance',
    label: 'My attendance',
    href: '/attendance',
    icon: <CalendarDays />,
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
}

export function StudentDashboard({ userName }: Props) {
  return (
    <ShellMain>
      <DashboardLayout
        header={
          <PageHeader
            title={`${greeting()}, ${userName}`}
            meta={[
              { key: 'class', label: 'JSS 2A', emphasis: true },
              { key: 'term', label: 'Spring Term 2025 · Week 6' },
            ]}
          />
        }
        stats={<StatGrid items={STATS} minTileWidth={140} />}
        aside={
          <>
            <DashboardQuickActions
              actions={QUICK_ACTIONS}
              description="Learning tasks"
            />
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="text-base">Recent grades</CardTitle>
                <CardDescription>Last week</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {RECENT_GRADES.map((g) => (
                  <div
                    key={g.key}
                    className="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-border bg-card p-3"
                  >
                    <span className="truncate text-sm font-medium text-foreground">
                      {g.subject}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {g.score}
                      </span>
                      <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-bold text-primary">
                        {g.grade}
                      </span>
                    </div>
                  </div>
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-1 w-full text-xs"
                  asChild
                >
                  <Link href="/classes/gradebook">View all grades</Link>
                </Button>
              </CardContent>
            </Card>
          </>
        }
      >
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-base">Today&apos;s schedule</CardTitle>
            <CardDescription>Wednesday · JSS 2A</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {SCHEDULE.map((cls) => (
              <div
                key={cls.key}
                className="flex items-center gap-3 rounded-[var(--radius-sm)] border border-border bg-card p-3"
              >
                <span
                  className={
                    cls.done
                      ? 'grid size-7 shrink-0 place-items-center rounded-full bg-success/15 text-success'
                      : 'grid size-7 shrink-0 place-items-center rounded-full bg-primary/10 text-primary'
                  }
                >
                  {cls.done ? (
                    <CheckCircle2 className="size-4" />
                  ) : (
                    <Clock className="size-4" />
                  )}
                </span>
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-semibold text-foreground">
                    {cls.subject}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {cls.time} · {cls.room} · {cls.teacher}
                  </span>
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" className="mt-1" asChild>
              <Link href="/classes/timetable">Full timetable</Link>
            </Button>
          </CardContent>
        </Card>
      </DashboardLayout>
    </ShellMain>
  );
}
