import { requirePermission } from '@/lib/access';

export default async function StudentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePermission('students.view');
  return <>{children}</>;
}
