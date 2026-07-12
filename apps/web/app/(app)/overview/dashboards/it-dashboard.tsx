'use client';

import { Activity, Settings, ShieldCheck, Users } from 'lucide-react';
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
    key: 'users',
    label: 'Active accounts',
    value: '1,516',
    icon: <Users />,
    href: '/settings/users',
  },
  {
    key: 'sessions',
    label: 'Active sessions',
    value: '214',
    icon: <Activity />,
  },
  {
    key: 'health',
    label: 'System health',
    value: '100%',
    icon: <Activity />,
    delta: { label: 'All systems go', direction: 'up', intent: 'positive' },
  },
  {
    key: 'pending',
    label: 'Pending roles',
    value: '3',
    icon: <ShieldCheck />,
    delta: { label: 'Awaiting approval', direction: 'up', intent: 'negative' },
    href: '/settings/roles',
  },
];

const QUICK_LINKS = [
  {
    key: 'users',
    label: 'Manage users',
    desc: 'Create, edit, suspend accounts',
    href: '/settings/users',
    icon: <Users className="size-4" />,
  },
  {
    key: 'roles',
    label: 'Roles & permissions',
    desc: 'Configure access levels',
    href: '/settings/roles',
    icon: <ShieldCheck className="size-4" />,
  },
  {
    key: 'audit',
    label: 'Audit log',
    desc: 'Review system activity',
    href: '/settings/audit',
    icon: <Activity className="size-4" />,
  },
  {
    key: 'settings',
    label: 'School settings',
    desc: 'Platform configuration',
    href: '/settings/school',
    icon: <Settings className="size-4" />,
  },
];

const AUDIT_EVENTS = [
  {
    key: 'a1',
    text: 'Role "Finance" updated — permissions changed',
    when: '20 min ago',
    severity: 'warning' as const,
  },
  {
    key: 'a2',
    text: 'New user created: bursar2@sja.test',
    when: '2h ago',
    severity: 'info' as const,
  },
  {
    key: 'a3',
    text: 'Failed login attempt (x3) — ngozi.c@sja.test',
    when: '4h ago',
    severity: 'warning' as const,
  },
  {
    key: 'a4',
    text: 'Backup completed successfully',
    when: '6h ago',
    severity: 'info' as const,
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

export function ITDashboard({ userName }: Props) {
  return (
    <ShellMain>
      <DashboardLayout
        header={
          <PageHeader
            title={`${greeting()}, ${userName}`}
            meta={[
              { key: 'role', label: 'IT Support', emphasis: true },
              { key: 'status', label: 'All systems operational' },
            ]}
            actions={
              <Button size="sm" asChild>
                <Link href="/settings/users">
                  <Users className="size-4" /> Manage users
                </Link>
              </Button>
            }
          />
        }
        stats={<StatGrid items={STATS} minTileWidth={170} />}
        aside={
          <>
            <DashboardQuickActions
              actions={QUICK_LINKS}
              description="IT administration tasks"
            />
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="text-base">Recent audit events</CardTitle>
                <CardDescription>Last 24 hours</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {AUDIT_EVENTS.map((e) => (
                  <div key={e.key} className="flex items-start gap-2">
                    <span
                      className={`mt-0.5 size-1.5 shrink-0 rounded-full ${e.severity === 'warning' ? 'bg-warning' : 'bg-muted-foreground'}`}
                    />
                    <div className="flex min-w-0 flex-col">
                      <span className="text-xs text-foreground">{e.text}</span>
                      <span className="text-xs text-muted-foreground">
                        {e.when}
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
                  <Link href="/settings/audit">Full audit log</Link>
                </Button>
              </CardContent>
            </Card>
          </>
        }
      >
        <div />
      </DashboardLayout>
    </ShellMain>
  );
}
