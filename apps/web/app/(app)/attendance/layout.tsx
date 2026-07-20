import { requirePermission } from '@/lib/access';

export default async function AttendanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePermission('attendance.view');
  return <>{children}</>;
}
