import { requirePermission } from '@/lib/access';

export default async function LibraryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePermission('library.view');
  return <>{children}</>;
}
