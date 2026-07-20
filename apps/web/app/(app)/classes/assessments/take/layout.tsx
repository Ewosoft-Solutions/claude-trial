import { requirePermission } from '@/lib/access';

export default async function AssessmentTakingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePermission('assessments.take');
  return <>{children}</>;
}
