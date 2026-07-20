import { requireAnyPermission } from '@/lib/access';

export default async function HrLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAnyPermission(['hr.view', 'payroll.view']);
  return <>{children}</>;
}
