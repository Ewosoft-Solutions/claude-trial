import { requirePermission } from '@/lib/access';

export default async function AcademicReviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePermission('lessons.approve');
  return <>{children}</>;
}
