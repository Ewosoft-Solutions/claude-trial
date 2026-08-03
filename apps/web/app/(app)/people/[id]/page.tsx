import { getPersonDetail } from './get-detail';
import { PersonProfileShell, ProfileMissing } from './profile-shell';
import { PersonOverview } from '../person-detail-ui';

export default async function PersonOverviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string }>;
}) {
  const { id } = await params;
  const { type } = await searchParams;
  const detail = await getPersonDetail(id, type);
  if (!detail) return <ProfileMissing />;

  return (
    <PersonProfileShell
      detail={detail}
      activeTab="overview"
      type={type ?? 'all'}
    >
      <PersonOverview detail={detail} />
    </PersonProfileShell>
  );
}
