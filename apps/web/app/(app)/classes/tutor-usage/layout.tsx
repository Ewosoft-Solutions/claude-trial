import { requirePermission } from '@/lib/access';

export default async function TutorUsageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Full lesson viewers (teachers/admins) only — students hold lessons.view.own.
  await requirePermission('lessons.view');
  return <>{children}</>;
}
