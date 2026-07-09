import { requireAnyPermission } from '@/lib/access';

export default async function ClassesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAnyPermission([
    'courses.view',
    'schedules.view',
    'lessons.view.own',
    'assessments.take',
  ]);
  return <>{children}</>;
}
