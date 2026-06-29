import { requireAnyPermission, requireMinClearance } from '@/lib/access';

export default async function FinanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireMinClearance(5);
  await requireAnyPermission(['fees.view', 'financial_reports.view', 'billing.view', 'payments.view']);
  return <>{children}</>;
}
