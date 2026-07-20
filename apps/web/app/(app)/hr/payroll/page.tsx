/* ============================================================
   /hr/payroll — staff payroll (server component)

   Fetches payroll records from the NestJS backend (server-side,
   cookie-authenticated) and passes them to PayrollClient.
   Empty API responses render as empty states in the client.
   ============================================================ */

import { serverApiGet } from '@/lib/server-api';
import { PayrollClient, type PayrollRow, type PayrollStatus } from './payroll-client';

interface ApiPayrollRecord {
  id: string;
  staffName: string;
  role: string | null;
  payPeriod: string;
  grossPay: string | number;
  netPay: string | number;
  status: PayrollStatus;
}

export default async function PayrollPage() {
  const data = await serverApiGet<ApiPayrollRecord[] | { data?: ApiPayrollRecord[] }>('/hr/payroll');

  const raw: ApiPayrollRecord[] = Array.isArray(data)
    ? data
    : (data as { data?: ApiPayrollRecord[] } | null)?.data ?? [];

  const records: PayrollRow[] = raw.map((r) => ({
    id: r.id,
    staffName: r.staffName,
    role: r.role,
    payPeriod: r.payPeriod,
    grossPay: Number(r.grossPay),
    netPay: Number(r.netPay),
    status: r.status,
  }));

  return <PayrollClient records={records} />;
}
