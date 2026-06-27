/* ============================================================
   /finance/invoices — fee invoices (server component)

   Fetches invoices from the NestJS backend (server-side,
   cookie-authenticated) and passes them to InvoicesClient.
   Falls back to built-in mock data when NEXT_PUBLIC_API_URL
   is not set (dev mode).
   ============================================================ */

import { serverApiGet } from '@/lib/server-api';
import { InvoicesClient, type Invoice } from './invoices-client';

interface ApiInvoice {
  id: string;
  invoiceNumber: string;
  studentId: string;
  classId?: string | null;
  termName?: string | null;
  issuedDate?: string | null;
  dueDate?: string | null;
  amountDue: number;
  amountPaid: number;
  status: string;
}

function formatDate(iso: string | null | undefined): string | undefined {
  if (!iso) return undefined;
  try {
    return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short' }).format(new Date(iso));
  } catch {
    return undefined;
  }
}

export default async function InvoicesPage() {
  const data = await serverApiGet<ApiInvoice[] | { data?: ApiInvoice[] }>('/finance/invoices?limit=200');

  const raw: ApiInvoice[] = Array.isArray(data)
    ? data
    : (data as { data?: ApiInvoice[] } | null)?.data ?? [];

  const invoices: Invoice[] = raw.map((inv) => ({
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    studentId: inv.studentId,
    issued: formatDate(inv.issuedDate),
    due: formatDate(inv.dueDate),
    amountDue: inv.amountDue,
    amountPaid: inv.amountPaid,
    status: inv.status as Invoice['status'],
  }));

  return <InvoicesClient invoices={invoices} />;
}
