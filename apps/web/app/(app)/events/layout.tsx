import { requirePermission } from '@/lib/access';

export default async function EventsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePermission('events.view');
  return <>{children}</>;
}
