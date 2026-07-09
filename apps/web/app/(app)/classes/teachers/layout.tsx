import { requirePermission } from '@/lib/access';

export default async function ClassTeachersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePermission('classes.teachers.assign');
  return <>{children}</>;
}
