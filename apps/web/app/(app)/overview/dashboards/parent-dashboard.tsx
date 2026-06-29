'use client';

import { Banknote, BookOpen, CalendarDays, MessageSquare } from 'lucide-react';

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
  { key: 'attendance', label: "Child's attendance", value: '91%', icon: <CalendarDays /> },
  { key: 'average', label: 'Current average', value: '74%', icon: <BookOpen /> },
  { key: 'fee', label: 'Fee balance', value: '₦35,000', icon: <Banknote />, delta: { label: 'Due 30 Jun', direction: 'up', intent: 'negative' } },
  { key: 'messages', label: 'Unread messages', value: '2', icon: <MessageSquare /> },
];

const RECENT_GRADES = [
  { key: 'g1', subject: 'Mathematics', score: '82/100', grade: 'B', when: 'Mon' },
  { key: 'g2', subject: 'English Language', score: '76/100', grade: 'B', when: 'Wed' },
  { key: 'g3', subject: 'Basic Science', score: '90/100', grade: 'A', when: 'Fri' },
];

const UPCOMING = [
  { key: 'e1', text: 'Physics test', when: 'Monday, 9 AM' },
  { key: 'e2', text: 'Parent-teacher meeting', when: 'Friday, 2 PM' },
  { key: 'e3', text: 'School cultural day', when: '12 July' },
];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

interface Props { userName: string; schoolName: string }

export function ParentDashboard({ userName, schoolName }: Props) {
  return (
    <ShellMain>
      <DashboardLayout
        header={
          <PageHeader
            title={`${greeting()}, ${userName}`}
            meta={[
              { key: 'child', label: 'Tunde Afolabi · JSS 2A', emphasis: true },
              { key: 'term', label: 'Spring Term 2025' },
            ]}
            actions={
              <Button size="sm">
                <MessageSquare className="size-4" /> Send message
              </Button>
            }
          />
        }
        stats={<StatGrid items={STATS} />}
        aside={
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-base">Upcoming</CardTitle>
              <CardDescription>{schoolName}</CardDescription>
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
            <CardTitle className="text-base">Recent grades</CardTitle>
            <CardDescription>Tunde Afolabi · last 7 days</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {RECENT_GRADES.map((g) => (
              <div key={g.key} className="flex items-center gap-3 rounded-[var(--radius-sm)] border border-border bg-card p-3">
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-semibold text-foreground">{g.subject}</span>
                  <span className="text-xs text-muted-foreground">{g.score}</span>
                </div>
                <span className="ml-auto shrink-0 rounded bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                  {g.grade}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">{g.when}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="flex-1 shadow-card">
          <CardHeader>
            <CardTitle className="text-base">Fee statement</CardTitle>
            <CardDescription>Spring Term 2025</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Term fees</span>
              <span className="font-medium">₦120,000</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Paid</span>
              <span className="font-medium text-success">₦85,000</span>
            </div>
            <div className="h-px bg-border" />
            <div className="flex justify-between text-sm">
              <span className="font-semibold">Balance</span>
              <span className="font-bold text-destructive">₦35,000</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-success" style={{ width: '71%' }} />
            </div>
            <p className="text-xs text-muted-foreground">Due 30 June 2025</p>
            <Button className="mt-1 w-full" size="sm">Pay balance</Button>
          </CardContent>
        </Card>
      </DashboardLayout>
    </ShellMain>
  );
}
