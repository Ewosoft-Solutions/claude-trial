import { getSession } from '@/lib/session';
import { getPersonDetail } from '../get-detail';
import { PersonProfileShell, ProfileMissing } from '../profile-shell';
import { PersonPeople } from '../../person-detail-ui';
import { GuardianshipPanel } from '../guardianship-panel';

export default async function PersonPeoplePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string }>;
}) {
  const { id } = await params;
  const { type } = await searchParams;
  const [detail, session] = await Promise.all([
    getPersonDetail(id, type),
    getSession(),
  ]);
  if (!detail) return <ProfileMissing />;

  const has = (permission: string) =>
    session?.permissions.includes(permission as never) ?? false;

  const isWard = detail.profiles.includes('student');
  const isGuardian =
    detail.profiles.includes('guardian') || (detail.wards?.length ?? 0) > 0;
  const showGuardianship =
    has('guardians.view') &&
    detail.type !== 'prospect' &&
    (isWard || isGuardian);

  return (
    <PersonProfileShell detail={detail} activeTab="people" type={type ?? 'all'}>
      <div className="flex flex-col gap-6">
        <PersonPeople
          detail={detail}
          relationHref={(rid) => `/people/${rid}`}
        />
        {showGuardianship ? (
          <GuardianshipPanel
            personId={detail.id}
            isWard={isWard}
            isGuardian={isGuardian}
            canManage={has('guardians.manage')}
          />
        ) : null}
      </div>
    </PersonProfileShell>
  );
}
