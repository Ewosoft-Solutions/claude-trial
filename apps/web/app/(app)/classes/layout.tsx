import { requireAnyPermission } from '@/lib/access';

export default async function ClassesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAnyPermission(['courses.view', 'schedules.view']);
  return <>{children}</>;
}
