import { requirePermission } from '@/lib/access';

export default async function TutorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePermission('ai.chat.use');
  return <>{children}</>;
}
