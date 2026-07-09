import { Download } from 'lucide-react';

import { serverApiGet } from '@/lib/server-api';
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
import { StatGrid } from '@workspace/ui/custom/layouts/stat-grid';
import { Meter, type MeterTone } from '@workspace/ui/custom/data-display/meter';
import { DonutChart } from '@workspace/ui/custom/charts/donut-chart';
import type { ChartSlice } from '@workspace/ui/types/chart.types';
import type { StatItem } from '@workspace/ui/types/layout.types';
import type { PageHeaderMeta } from '@workspace/ui/types/shell.types';

type Paginated<T> = { data?: T[] };

interface ApiInvoice {
  id: string;
  studentId: string;
  classId?: string | null;
  termName?: string | null;
  issuedDate?: string | null;
  amountDue?: number | null;
  amountPaid?: number | null;
  status?: string | null;
}

interface ApiPayment {
  invoiceId?: string | null;
  paidAt?: string | null;
  amount?: number | null;
  status?: string | null;
}

interface ApiStudent {
  id: string;
  enrollments?: Array<{
    status?: string | null;
    class?: {
      id?: string | null;
      name?: string | null;
      section?: string | null;
      course?: { name?: string | null } | null;
    } | null;
  }>;
}

const STATUS_COLORS: Record<string, string> = {
  paid: 'var(--chart-2)',
  partial: 'var(--chart-3)',
  outstanding: 'var(--chart-4)',
  overdue: 'var(--chart-5)',
  draft: 'var(--chart-1)',
  issued: 'var(--chart-1)',
};

function asArray<T>(payload: T[] | Paginated<T> | null): T[] {
  if (Array.isArray(payload)) return payload;
  return payload?.data ?? [];
}

function nairaFromKobo(kobo: number): string {
  const naira = kobo / 100;
  if (naira >= 1_000_000) return `₦${(naira / 1_000_000).toFixed(1)}M`;
  if (naira >= 1_000) return `₦${Math.round(naira / 1_000)}k`;
  return `₦${naira}`;
}

function percent(numerator: number, denominator: number): number {
  return denominator > 0 ? Math.round((numerator / denominator) * 100) : 0;
}

function toneFor(value: number): MeterTone {
  if (value >= 85) return 'success';
  if (value >= 60) return 'info';
  return 'warning';
}

function studentClass(student: ApiStudent | undefined): string {
  const enrollment =
    student?.enrollments?.find((item) => item.status === 'active') ??
    student?.enrollments?.[0];
  const cls = enrollment?.class;
  if (!cls) return 'Unassigned';
  return cls.name ?? `${cls.course?.name ?? 'Class'} ${cls.section ?? ''}`.trim();
}

function daysBetween(start: string | null | undefined, end: string | null | undefined): number | null {
  if (!start || !end) return null;
  const from = new Date(start).getTime();
  const to = new Date(end).getTime();
  if (Number.isNaN(from) || Number.isNaN(to)) return null;
  return Math.max(0, Math.round((to - from) / 86_400_000));
}

export default async function FinanceReportsPage() {
  const [invoiceData, paymentData, studentData] = await Promise.all([
    serverApiGet<ApiInvoice[]>('/finance/invoices?limit=500'),
    serverApiGet<ApiPayment[]>('/finance/payments?limit=500'),
    serverApiGet<ApiStudent[] | Paginated<ApiStudent>>('/students?limit=1000'),
  ]);

  const invoices = invoiceData ?? [];
  const payments = paymentData ?? [];
  const students = asArray(studentData);
  const studentsById = new Map(students.map((student) => [student.id, student]));
  const invoicesById = new Map(invoices.map((invoice) => [invoice.id, invoice]));

  const totalBilled = invoices.reduce((sum, invoice) => sum + Number(invoice.amountDue ?? 0), 0);
  const totalCollected = invoices.reduce((sum, invoice) => sum + Number(invoice.amountPaid ?? 0), 0);
  const outstanding = Math.max(0, totalBilled - totalCollected);
  const collectionRate = percent(totalCollected, totalBilled);
  const completedPaymentDays = payments
    .filter((payment) => payment.status === 'completed')
    .map((payment) => daysBetween(invoicesById.get(payment.invoiceId ?? '')?.issuedDate, payment.paidAt))
    .filter((value): value is number => value !== null);
  const avgDays = completedPaymentDays.length
    ? Math.round(completedPaymentDays.reduce((sum, value) => sum + value, 0) / completedPaymentDays.length)
    : 0;

  const stats: StatItem[] = [
    { key: 'revenue', label: 'Revenue collected', value: nairaFromKobo(totalCollected) },
    { key: 'rate', label: 'Collection rate', value: `${collectionRate}%` },
    { key: 'outstanding', label: 'Outstanding', value: nairaFromKobo(outstanding) },
    { key: 'avgdays', label: 'Avg. days to pay', value: avgDays.toLocaleString() },
  ];

  const meta: PageHeaderMeta[] = [
    { key: 'source', label: 'live billing', emphasis: true },
    { key: 'invoices', label: `${invoices.length} invoices` },
  ];

  const statusTotals = new Map<string, number>();
  for (const invoice of invoices) {
    const status = invoice.status ?? 'outstanding';
    statusTotals.set(status, (statusTotals.get(status) ?? 0) + Number(invoice.amountDue ?? 0));
  }
  const feeStatus: ChartSlice[] = Array.from(statusTotals.entries()).map(([key, value]) => ({
    key,
    label: key.replace(/^\w/, (char) => char.toUpperCase()),
    value,
    color: STATUS_COLORS[key],
  }));

  const classTotals = new Map<string, { billed: number; collected: number }>();
  for (const invoice of invoices) {
    const label = studentClass(studentsById.get(invoice.studentId));
    const current = classTotals.get(label) ?? { billed: 0, collected: 0 };
    current.billed += Number(invoice.amountDue ?? 0);
    current.collected += Number(invoice.amountPaid ?? 0);
    classTotals.set(label, current);
  }
  const byClass = Array.from(classTotals.entries()).map(([label, totals]) => {
    const value = percent(totals.collected, totals.billed);
    return { label, value, tone: toneFor(value) };
  });

  const termTotals = new Map<string, number>();
  for (const invoice of invoices) {
    const label = invoice.termName ?? 'Unassigned';
    termTotals.set(label, (termTotals.get(label) ?? 0) + Number(invoice.amountDue ?? 0));
  }
  const byTerm = Array.from(termTotals.entries()).map(([label, amount]) => ({
    label,
    amount,
    value: percent(amount, totalBilled),
  }));

  return (
    <ShellMain>
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Financial reports"
          meta={meta}
          actions={
            <Button variant="outline" size="sm">
              <Download /> Export report
            </Button>
          }
        />

        <StatGrid items={stats} />

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-base">Fee status</CardTitle>
              <CardDescription>Share of billed fees by invoice status</CardDescription>
            </CardHeader>
            <CardContent>
              <DonutChart
                slices={feeStatus}
                height={240}
                aria-label="Fee status split by billed amount"
              />
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-base">Collection rate by class</CardTitle>
              <CardDescription>Collected share of billed fees</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3.5">
              {byClass.map((row) => (
                <Meter key={row.label} label={row.label} value={row.value} tone={row.tone} />
              ))}
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-base">Billing by term</CardTitle>
              <CardDescription>Share of invoice totals by term</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3.5">
              {byTerm.map((row) => (
                <Meter
                  key={row.label}
                  label={row.label}
                  value={row.value}
                  valueLabel={`${nairaFromKobo(row.amount)} · ${row.value}%`}
                />
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </ShellMain>
  );
}
