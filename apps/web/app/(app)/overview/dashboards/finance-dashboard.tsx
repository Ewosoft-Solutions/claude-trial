'use client';

import { Banknote, CircleAlert, CreditCard, TrendingUp } from 'lucide-react';
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
  { key: 'billed', label: 'Billed this month', value: '₦18.6M', icon: <CreditCard />, href: '/finance/invoices' },
  { key: 'collected', label: 'Collected', value: '₦15.5M', icon: <TrendingUp />, delta: { label: '83%', direction: 'up', intent: 'positive' } },
  { key: 'outstanding', label: 'Outstanding', value: '₦3.1M', icon: <Banknote />, delta: { label: '142 students', direction: 'up', intent: 'negative' }, href: '/finance/invoices' },
  { key: 'overdue', label: 'Overdue invoices', value: '28', icon: <CircleAlert />, delta: { label: 'Past due date', direction: 'up', intent: 'negative' }, href: '/finance/invoices' },
];

const OVERDUE = [
  { key: 'o1', student: 'Kemi Adetoye · JSS 1A', amount: '₦85,000', days: '12 days overdue' },
  { key: 'o2', student: 'Tunde Bello · SS 2B', amount: '₦120,000', days: '8 days overdue' },
  { key: 'o3', student: 'Amaka Obi · JSS 3A', amount: '₦95,000', days: '5 days overdue' },
  { key: 'o4', student: 'Sola Adeyemi · SS 1C', amount: '₦110,000', days: '3 days overdue' },
];

const PAYMENTS = [
  { key: 'p1', student: 'Ngozi Chukwu', amount: '₦120,000', when: '10 min ago', method: 'Bank transfer' },
  { key: 'p2', student: 'Emeka Eze', amount: '₦85,000', when: '2h ago', method: 'Cash' },
  { key: 'p3', student: 'Fatima Musa', amount: '₦95,000', when: '4h ago', method: 'Online' },
];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

interface Props { userName: string; schoolName: string }

export function FinanceDashboard({ userName, schoolName }: Props) {
  return (
    <ShellMain>
      <DashboardLayout
        header={
          <PageHeader
            title={`${greeting()}, ${userName}`}
            meta={[
              { key: 'term', label: 'Spring Term 2025', emphasis: true },
              { key: 'role', label: 'Finance & Billing' },
            ]}
            actions={
              <>
                <Button variant="outline" size="sm" className="max-md:hidden" asChild>
                  <Link href="/finance/reports">Reports</Link>
                </Button>
                <Button size="sm" asChild>
                  <Link href="/finance/payments"><Banknote className="size-4" /> Record payment</Link>
                </Button>
              </>
            }
          />
        }
        stats={<StatGrid items={STATS} />}
        aside={
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-base">Recent payments</CardTitle>
              <CardDescription>Across {schoolName}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {PAYMENTS.map((p) => (
                <div key={p.key} className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium text-foreground">{p.student}</span>
                    <span className="text-xs text-muted-foreground">{p.method}</span>
                  </div>
                  <div className="flex shrink-0 flex-col items-end">
                    <span className="text-sm font-semibold text-foreground">{p.amount}</span>
                    <span className="text-xs text-muted-foreground">{p.when}</span>
                  </div>
                </div>
              ))}
              <Button variant="ghost" size="sm" className="mt-1 w-full text-xs" asChild>
                <Link href="/finance/payments">View all payments</Link>
              </Button>
            </CardContent>
          </Card>
        }
      >
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CircleAlert className="size-4 text-destructive" aria-hidden />
              Overdue invoices
            </CardTitle>
            <CardDescription>Students past their payment due date</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {OVERDUE.map((item) => (
              <div
                key={item.key}
                className="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-border bg-card p-3"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-semibold text-foreground">{item.student}</span>
                  <span className="text-xs text-destructive">{item.days}</span>
                </div>
                <span className="shrink-0 text-sm font-semibold text-foreground">{item.amount}</span>
              </div>
            ))}
            <Button variant="outline" size="sm" className="mt-1" asChild>
              <Link href="/finance/invoices">View all overdue</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="flex-1 shadow-card">
          <CardHeader>
            <CardTitle className="text-base">Collection rate</CardTitle>
            <CardDescription>Spring Term 2025 · target 95%</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {[
              { label: 'JSS 1', rate: 88 },
              { label: 'JSS 2', rate: 91 },
              { label: 'JSS 3', rate: 79 },
              { label: 'SS 1', rate: 95 },
              { label: 'SS 2', rate: 82 },
              { label: 'SS 3', rate: 97 },
            ].map((cls) => (
              <div key={cls.label} className="flex items-center gap-3">
                <span className="w-10 shrink-0 text-xs text-muted-foreground">{cls.label}</span>
                <div className="flex-1 overflow-hidden rounded-full bg-muted" style={{ height: 6 }}>
                  <div
                    className={cls.rate >= 90 ? 'h-full rounded-full bg-success' : cls.rate >= 80 ? 'h-full rounded-full bg-warning' : 'h-full rounded-full bg-destructive'}
                    style={{ width: `${cls.rate}%` }}
                  />
                </div>
                <span className="w-8 shrink-0 text-right text-xs font-medium">{cls.rate}%</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </DashboardLayout>
    </ShellMain>
  );
}
