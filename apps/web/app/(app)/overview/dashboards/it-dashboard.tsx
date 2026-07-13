'use client';

import { Activity, Mail, Settings, ShieldCheck, Users } from 'lucide-react';
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

const QUICK_LINKS = [
  {
    key: 'users',
    label: 'Manage users',
    href: '/settings/users',
    icon: <Users className="size-4" />,
  },
  {
    key: 'roles',
    label: 'Roles & permissions',
    href: '/settings/roles',
    icon: <ShieldCheck className="size-4" />,
  },
  {
    key: 'audit',
    label: 'Audit log',
    href: '/settings/audit',
    icon: <Activity className="size-4" />,
  },
  {
    key: 'settings',
    label: 'School settings',
    href: '/settings/general',
    icon: <Settings className="size-4" />,
  },
];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function ITDashboard({ userName }: { userName: string }) {
  const { stats, loading } = useOverviewStats();
  const s = stats?.school;
  const accounts = (s?.students ?? 0) + (s?.staff ?? 0);

  const STATS: StatItem[] = [
    {
      key: 'users',
      label: 'Accounts',
      value: loading ? '—' : formatCount(accounts),
      icon: <Users />,
      href: '/settings/users',
    },
    {
      key: 'staff',
      label: 'Staff',
      value: loading ? '—' : formatCount(s?.staff ?? 0),
      icon: <Users />,
      href: '/settings/users',
    },
    {
      key: 'invites',
      label: 'Pending invites',
      value: loading ? '—' : formatCount(s?.pendingInvitations ?? 0),
      icon: <Mail />,
      href: '/settings/users',
    },
    {
      key: 'announcements',
      label: 'Announcements',
      value: loading ? '—' : formatCount(s?.announcements ?? 0),
      icon: <Activity />,
    },
  ];

  return (
    <ShellMain>
      <DashboardLayout
        header={
          <PageHeader
            title={`${greeting()}, ${userName}`}
            meta={[{ key: 'role', label: 'IT Support', emphasis: true }]}
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
          <DashboardQuickActions
            actions={QUICK_LINKS}
            description="IT administration tasks"
          />
        }
      >
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-base">Audit log</CardTitle>
            <CardDescription>System activity for this school</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="rounded-[var(--radius-sm)] border border-dashed border-border p-4 text-sm text-muted-foreground">
              Review the full audit trail for user, role and security events.
            </p>
            <Button variant="outline" size="sm" className="mt-3" asChild>
              <Link href="/settings/audit">Open audit log</Link>
            </Button>
          </CardContent>
        </Card>
      </DashboardLayout>
    </ShellMain>
  );
}
