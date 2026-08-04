import { getSession } from '@/lib/session';
import { getPersonDetail } from './get-detail';
import { PersonProfileShell, ProfileMissing } from './profile-shell';
import { PersonOverview } from '../person-detail-ui';
import { AccountAccessPanel } from './account-access-panel';

export default async function PersonOverviewPage({
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

  // The interactive account panel shows to anyone who may view accounts; the
  // provisioning actions inside are additionally gated on `users.provision`
  // (server-side authoritative). Prospects are admission applications, not
  // Persons with a login, so the panel does not apply to them.
  const showAccountPanel = has('users.view') && detail.type !== 'prospect';

  return (
    <PersonProfileShell
      detail={detail}
      activeTab="overview"
      type={type ?? 'all'}
    >
      <PersonOverview
        detail={detail}
        accountSlot={
          showAccountPanel ? (
            <AccountAccessPanel
              personId={detail.id}
              canProvision={has('users.provision')}
            />
          ) : undefined
        }
      />
    </PersonProfileShell>
  );
}
