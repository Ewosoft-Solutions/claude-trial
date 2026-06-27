/* ============================================================
   /finance/payments — payment receipts (server component)

   Fetches payments from the NestJS backend (server-side,
   cookie-authenticated) and passes them to PaymentsClient.
   Falls back to built-in mock data when NEXT_PUBLIC_API_URL
   is not set (dev mode).
   ============================================================ */

import { serverApiGet } from '@/lib/server-api';
import { PaymentsClient, type Payment } from './payments-client';

interface ApiPayment {
  id: string;
  receiptNumber: string;
  invoiceId: string;
  studentId: string;
  method: string;
  paidAt: string;
  amount: number;
  status: string;
  invoice?: { invoiceNumber?: string; studentId?: string };
}

function formatDate(iso: string | null | undefined): string | undefined {
  if (!iso) return undefined;
  try {
    return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short' }).format(new Date(iso));
  } catch {
    return undefined;
  }
}

export default async function PaymentsPage() {
  const data = await serverApiGet<ApiPayment[] | { data?: ApiPayment[] }>('/finance/payments?limit=200');

  const raw: ApiPayment[] = Array.isArray(data)
    ? data
    : (data as { data?: ApiPayment[] } | null)?.data ?? [];

  const payments: Payment[] = raw.map((p) => ({
    id: p.id,
    receiptNumber: p.receiptNumber,
    invoiceId: p.invoiceId,
    studentId: p.studentId,
    method: p.method as Payment['method'],
    date: formatDate(p.paidAt),
    amount: p.amount,
    status: p.status as Payment['status'],
  }));

  return <PaymentsClient payments={payments} />;
}
