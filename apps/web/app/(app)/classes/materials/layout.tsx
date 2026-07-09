import { requireAnyPermission } from '@/lib/access';

export default async function MaterialsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAnyPermission(['lessons.view', 'lessons.view.own']);
  return <>{children}</>;
}
