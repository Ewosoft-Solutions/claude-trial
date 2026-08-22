import { serverApiGet } from '@/lib/server-api';
import { getSession } from '@/lib/session';
import { getPersonDetail } from './get-detail';
import { PersonOverview } from '../person-detail-ui';
import { AccountAccessPanel, type AccountState } from './account-access-panel';
import {
  AccessScopePanel,
  type Campus,
  type GrantState,
  type Role,
} from './access-scope-panel';
import {
  StaffEmploymentPanel,
  type Employment,
} from './staff-employment-panel';

export default async function PersonOverviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string }>;
}) {
  const { id } = await params;
  // Not for the fetch — the id identifies the person on its own now. This is
  // the directory tab the reader arrived from, which widens the employment
  // panel to someone being looked at AS staff.
  const { type } = await searchParams;
  const [detail, session] = await Promise.all([
    getPersonDetail(id),
    getSession(),
  ]);
  // The layout already showed `ProfileMissing` in this case.
  if (!detail) return null;

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

  // WB1-6 · the access-grants panel (scope + expiry + maker-checker approvals)
  // shows to holders of `access.grants.manage`; the actions inside are enforced
  // server-side. Prospects have no login to grant a role to.
  const showAccessPanel =
    has('access.grants.manage') && detail.type !== 'prospect';

  // Both panels used to fetch this on mount, independently — so Overview asked
  // for the same account state TWICE, and the route's skeleton was replaced by
  // their two much smaller ones. Resolved once here: one request, and the
  // skeleton is replaced by content.
  const account =
    showAccountPanel || showAccessPanel
      ? await serverApiGet<AccountState>(
          `/directory/people/${encodeURIComponent(detail.id)}/account`,
        )
      : null;

  const employment = showEmploymentPanel
    ? ((
        await serverApiGet<{ data?: Employment[] }>(
          `/directory/people/${encodeURIComponent(detail.id)}/employment`,
        )
      )?.data ?? [])
    : undefined;

  const profileId = account?.hasAccount ? (account.userTenantId ?? null) : null;
  const [grants, campusRows, roleRows] =
    showAccessPanel && profileId
      ? await Promise.all([
          serverApiGet<GrantState>(`/access/profiles/${profileId}/grants`),
          serverApiGet<Campus[]>('/campuses'),
          serverApiGet<Role[]>('/roles'),
        ])
      : [null, null, null];

  // Project to the fields the panel actually renders before handing these to a
  // CLIENT component. Everything crossing that boundary is serialised into the
  // page's payload, and `/roles` answers with each role's FULL permission list
  // — ~192 keys apiece, ten roles. Typing the fetch as `Role[]` does not strip
  // them: TypeScript is structural, the runtime object arrives whole. Left
  // unprojected this put ~1900 permission strings on the wire for a panel that
  // only ever shows a role's name.
  const campuses =
    campusRows?.map((c) => ({ id: c.id, name: c.name, code: c.code })) ?? [];
  const roles = roleRows?.map((r) => ({ id: r.id, name: r.name })) ?? [];

  return (
    <PersonOverview
      detail={detail}
      employmentSlot={
        showEmploymentPanel ? (
          <StaffEmploymentPanel
            key={detail.id}
            personId={detail.id}
            initialRows={employment}
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
            key={detail.id}
            personId={detail.id}
            canProvision={has('users.provision')}
            initialState={account}
          />
        ) : undefined
      }
      accessSlot={
        showAccessPanel ? (
          <AccessScopePanel
            key={detail.id}
            personId={detail.id}
            currentUserId={session?.accountId ?? ''}
            canManage={has('access.grants.manage')}
            initial={{
              profileId,
              grants: grants ?? null,
              campuses,
              roles,
            }}
          />
        ) : undefined
      }
    />
  );
}
