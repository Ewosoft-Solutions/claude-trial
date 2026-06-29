import { requirePermission } from '@/lib/access';

export default async function TransportLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePermission('transportation.view');
  return <>{children}</>;
}
