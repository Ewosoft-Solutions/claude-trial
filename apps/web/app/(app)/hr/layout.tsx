import { requirePermission } from '@/lib/access';

export default async function HrLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePermission('hr.view');
  return <>{children}</>;
}
