import { requirePermission } from '@/lib/access';

export default async function HealthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePermission('health.view');
  return <>{children}</>;
}
