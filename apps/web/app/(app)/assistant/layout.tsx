import { requirePermission } from '@/lib/access';

export default async function AssistantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePermission('ai.analytics.query');
  return <>{children}</>;
}
