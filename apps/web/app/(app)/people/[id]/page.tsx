import { getSession } from '@/lib/session';
import { getPersonDetail } from './get-detail';
import { PersonProfileShell, ProfileMissing } from './profile-shell';
import { PersonOverview } from '../person-detail-ui';
import { AccountAccessPanel } from './account-access-panel';
import { StaffEmploymentPanel } from './staff-employment-panel';

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

  // The interactive employment panel shows to staff-viewers on a staff person
  // (or the Staff tab); the management actions inside are additionally gated
  // server-side on staff.create / staff.edit / staff.delete.
  const showEmploymentPanel =
    has('staff.view') &&
    detail.type !== 'prospect' &&
    (type === 'staff' || detail.profiles.includes('staff'));

  return (
    <PersonProfileShell
      detail={detail}
      activeTab="overview"
      type={type ?? 'all'}
    >
      <PersonOverview
        detail={detail}
        employmentSlot={
          showEmploymentPanel ? (
            <StaffEmploymentPanel
              personId={detail.id}
              perms={{
                create: has('staff.create'),
                edit: has('staff.edit'),
                delete: has('staff.delete'),
              }}
            />
          ) : undefined
        }
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
