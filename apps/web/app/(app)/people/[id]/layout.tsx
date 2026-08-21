import { getPersonDetail } from './get-detail';
import { PersonProfileShell, ProfileMissing } from './profile-shell';

/**
 * The profile's persistent chrome.
 *
 * Everything that is the same on every tab is fetched and rendered ONCE here.
 * Next.js preserves a layout across navigation between its children, so a tab
 * click re-renders only `children` — the header, chips and tab strip stay put
 * and the person is not re-fetched.
 */
export default async function PersonProfileLayout({
  params,
  children,
}: {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
}) {
  const { id } = await params;
  const detail = await getPersonDetail(id);
  if (!detail) return <ProfileMissing />;

  return <PersonProfileShell detail={detail}>{children}</PersonProfileShell>;
}
