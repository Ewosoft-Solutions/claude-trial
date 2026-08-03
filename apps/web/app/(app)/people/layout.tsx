import { requirePermission } from '@/lib/access';

export default async function PeopleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Workbench-wide gate; each tab additionally enforces its type permission
  // both server-side (the API) and in the UI (disabled tab + denied state).
  await requirePermission('people.view');
  return <>{children}</>;
}
