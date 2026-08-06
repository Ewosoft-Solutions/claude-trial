/* ============================================================
   /hr/payroll — staff payroll (server component)

   Server-driven list: search / status filter / sort / paging run at the DB
   (via the URL → the paginated `/hr/payroll` endpoint). Stat tiles come from
   the whole-set `/hr/payroll/summary`, so they stay accurate on any page.
   ============================================================ */

import { serverApiGet } from '@/lib/server-api';
import { toListQuery } from '@/lib/list-query';
import {
  PayrollClient,
  type PayrollRow,
  type PayrollStats,
  type PayrollStatus,
} from './payroll-client';

const DEFAULT_PAGE_SIZE = 25;

interface ApiPayrollRecord {
  id: string;
  staffName: string;
  role: string | null;
  payPeriod: string;
  grossPay: string | number;
  netPay: string | number;
  status: PayrollStatus;
}

interface PayrollResponse {
  data: ApiPayrollRecord[];
  pagination: { total: number };
}

interface PayrollSummary {
  totalRecords: number;
  statusCounts: Record<string, number>;
  totalGross: number;
  totalNet: number;
}

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const { params } = toListQuery(sp, {
    defaultPageSize: DEFAULT_PAGE_SIZE,
    filters: { status: 'status', payPeriod: 'payPeriod' },
  });

  const [list, summary] = await Promise.all([
    serverApiGet<PayrollResponse>(`/hr/payroll?${params.toString()}`),
    serverApiGet<PayrollSummary>('/hr/payroll/summary'),
  ]);

  const raw = list?.data ?? [];
  const records: PayrollRow[] = raw.map((r) => ({
    id: r.id,
    staffName: r.staffName,
    role: r.role,
    payPeriod: r.payPeriod,
    grossPay: Number(r.grossPay),
    netPay: Number(r.netPay),
    status: r.status,
  }));

  const counts = summary?.statusCounts ?? {};
  const stats: PayrollStats = {
    total: summary?.totalRecords ?? 0,
    draft: counts.draft ?? 0,
    approved: counts.approved ?? 0,
    netPay: summary?.totalNet ?? 0,
  };

  return (
    <PayrollClient
      records={records}
      total={list?.pagination.total ?? 0}
      defaultPageSize={DEFAULT_PAGE_SIZE}
      stats={stats}
    />
  );
}
