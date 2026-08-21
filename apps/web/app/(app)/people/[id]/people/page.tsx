import { serverApiGet } from '@/lib/server-api';
import { getSession } from '@/lib/session';
import { getPersonDetail } from '../get-detail';
import { PersonPeople } from '../../person-detail-ui';
import { GuardianshipPanel, type Guardianship } from '../guardianship-panel';

export default async function PersonPeoplePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [detail, session] = await Promise.all([
    getPersonDetail(id),
    getSession(),
  ]);
  // The layout already showed `ProfileMissing` in this case.
  if (!detail) return null;

  const has = (permission: string) =>
    session?.permissions.includes(permission as never) ?? false;

  const isWard = detail.profiles.includes('student');
  const isGuardian =
    detail.profiles.includes('guardian') || (detail.wards?.length ?? 0) > 0;
  const showGuardianship =
    has('guardians.view') &&
    detail.type !== 'prospect' &&
    (isWard || isGuardian);

  // Resolved here rather than by the panel on mount, so this tab has ONE wait:
  // the route skeleton is replaced by content, not by the panel's own skeleton.
  const [asWard, asGuardian] = showGuardianship
    ? await Promise.all([
        isWard
          ? ((await serverApiGet<Guardianship[]>(
              `/guardianships?wardPersonId=${encodeURIComponent(detail.id)}`,
            )) ?? [])
          : [],
        isGuardian
          ? ((await serverApiGet<Guardianship[]>(
              `/guardianships?guardianPersonId=${encodeURIComponent(detail.id)}`,
            )) ?? [])
          : [],
      ])
    : [[], []];

  return (
    <div className="flex flex-col gap-6">
      <PersonPeople
        detail={detail}
        relationHref={(rid) => `/people/${rid}`}
        hideGuardianships={showGuardianship}
      />
      {showGuardianship ? (
        <GuardianshipPanel
          key={detail.id}
          personId={detail.id}
          isWard={isWard}
          isGuardian={isGuardian}
          canManage={has('guardians.manage')}
          initialAsWard={asWard}
          initialAsGuardian={asGuardian}
        />
      ) : null}
    </div>
  );
}
