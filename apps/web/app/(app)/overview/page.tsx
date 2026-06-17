'use client';

/* ============================================================
   /overview — the school dashboard (first authenticated surface)

   Built from the shared M6 layout patterns (DashboardLayout +
   StatGrid) and primitives — no one-off UI. Product copy lives here
   in the page; the shared components stay data-driven. Greeting +
   tenant come from the live ViewerContext (useViewer).
   ============================================================ */

import {
  Banknote,
  CalendarClock,
  GraduationCap,
  TriangleAlert,
  UserPlus,
  Users,
} from 'lucide-react';

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
import type { PageHeaderMeta } from '@workspace/ui/types/shell.types';

import { useViewer } from '@/app/providers/viewer-provider';

const STATS: StatItem[] = [
  {
    key: 'students',
    label: 'Total students',
    value: '1,420',
    icon: <Users />,
    delta: { label: '+3%', direction: 'up', intent: 'positive' },
    href: '/students/directory',
  },
  { key: 'staff', label: 'Total staff', value: '96', icon: <GraduationCap /> },
  {
    key: 'revenue',
    label: 'Revenue (mo)',
    value: '₦12.4M',
    icon: <Banknote />,
    delta: { label: '+9%', direction: 'up', intent: 'positive' },
    href: '/finance/reports',
  },
  {
    key: 'outstanding',
    label: 'Outstanding fees',
    value: '₦3.1M',
    delta: { label: '142 students', direction: 'up', intent: 'negative' },
    href: '/finance/invoices',
  },
  { key: 'attendance', label: 'Attendance', value: '94%' },
  { key: 'events', label: 'Upcoming events', value: '5', icon: <CalendarClock /> },
];

const META: PageHeaderMeta[] = [
  { key: 'term', label: 'Spring Term 2025', emphasis: true },
  { key: 'week', label: 'Week 6 of 13' },
  { key: 'updated', label: 'updated 2m ago' },
];

interface AttentionItem {
  key: string;
  title: string;
  meta: string;
  tone: 'warning' | 'neutral';
  icon: React.ReactNode;
  href: string;
}

const ATTENTION: AttentionItem[] = [
  {
    key: 'admissions',
    title: '38 admission applications',
    meta: 'Pending review',
    tone: 'warning',
    icon: <UserPlus className="size-4" />,
    href: '/students/enrollment',
  },
  {
    key: 'fees',
    title: '₦3.1M outstanding fees',
    meta: '142 students · reminders due',
    tone: 'warning',
    icon: <Banknote className="size-4" />,
    href: '/finance/invoices',
  },
  {
    key: 'term-end',
    title: 'Term ends in 3 weeks',
    meta: 'Plan results & report cards',
    tone: 'neutral',
    icon: <CalendarClock className="size-4" />,
    href: '/students/gradebook/report-cards',
  },
];

const ACTIVITY: { key: string; text: string; when: string }[] = [
  { key: 'a1', text: '₦240k fees collected', when: '12 min ago' },
  { key: 'a2', text: 'New admission: J. Okoro', when: '1h ago' },
  { key: 'a3', text: 'Announcement sent to all parents', when: '3h ago' },
  { key: 'a4', text: '2 lesson notes uploaded', when: '5h ago' },
];

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function OverviewPage() {
  const { user, schools, activeSchoolId } = useViewer();
  const schoolName =
    schools.find((s) => s.id === activeSchoolId)?.name ?? 'your school';

  return (
    <ShellMain>
      <DashboardLayout
        header={
          <PageHeader
            title={`${greeting()}, ${user.name}`}
            meta={META}
            actions={
              <>
                <Button variant="outline" size="sm" className="max-md:hidden">
                  View reports
                </Button>
                <Button size="sm">
                  <UserPlus /> Add student
                </Button>
              </>
            }
          />
        }
        stats={<StatGrid items={STATS} />}
        aside={
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-base">Recent activity</CardTitle>
              <CardDescription>Across {schoolName}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {ACTIVITY.map((a) => (
                <div key={a.key} className="flex items-start justify-between gap-3">
                  <span className="text-sm text-foreground">{a.text}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {a.when}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        }
      >
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TriangleAlert className="size-4 text-warning" aria-hidden />
              Needs attention
            </CardTitle>
            <CardDescription>
              Items waiting on you before term-end
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {ATTENTION.map((item) => (
              <a
                key={item.key}
                href={item.href}
                className="flex items-center gap-3 rounded-[var(--radius-sm)] border border-border bg-card p-3 outline-none transition-colors hover:border-ring/60 hover:bg-accent/40 focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <span
                  className={
                    item.tone === 'warning'
                      ? 'grid size-8 shrink-0 place-items-center rounded-lg bg-warning/15 text-warning'
                      : 'grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground'
                  }
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
                {item.tone === 'warning' ? (
                  <Badge variant="outline" className="ml-auto shrink-0">
                    Action
                  </Badge>
                ) : null}
              </a>
            ))}
          </CardContent>
        </Card>

        <Card className="flex-1 shadow-card">
          <CardHeader>
            <CardTitle className="text-base">Enrollment overview</CardTitle>
            <CardDescription>
              446 of 480 seats confirmed for the Spring intake · 34 open
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <div className="h-2 overflow-hidden rounded bg-muted">
              <div
                className="h-full rounded bg-primary"
                style={{ width: '93%' }}
              />
            </div>
            <div className="text-xs text-muted-foreground">
              93% of capacity confirmed
            </div>
          </CardContent>
        </Card>
      </DashboardLayout>
    </ShellMain>
  );
}
