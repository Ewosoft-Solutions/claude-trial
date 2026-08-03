import { getPersonDetail } from '../get-detail';
import { PersonProfileShell, ProfileMissing } from '../profile-shell';
import { PersonPeople } from '../../person-detail-ui';

export default async function PersonPeoplePage({
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
    <PersonProfileShell detail={detail} activeTab="people" type={type ?? 'all'}>
      <PersonPeople detail={detail} relationHref={(rid) => `/people/${rid}`} />
    </PersonProfileShell>
  );
}
