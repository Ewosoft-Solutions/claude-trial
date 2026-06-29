import { requireAnyPermission } from '@/lib/access';

export default async function ReportsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAnyPermission(['reports.view', 'analytics.view']);
  return <>{children}</>;
}
