'use client';

/* ============================================================
   UsersClient — tenant users (client-side DirectoryTable)

   The tenant users endpoint returns up to 200 profiles in one shot, so
   search / status + role + verified filters / sort / paging run in-memory.
   All three filters collapse into the Pattern-B Filters button.
   ============================================================ */

import * as React from 'react';

import { Avatar, AvatarFallback } from '@workspace/ui/components/avatar';
import {
  DirectoryTable,
  type DirectoryColumn,
} from '@workspace/ui/custom/tables/directory-table';
import { StatusBadge } from '@workspace/ui/custom/data-display/status-badge';
import { EmptyState } from '@workspace/ui/custom/states/page-states';
import type { StateTone } from '@workspace/ui/types/states.types';
import type { DirectorySort } from '@workspace/ui/lib/directory-state';

import { DEFAULT_PAGE_SIZE } from '@/lib/page-size';

type ProfileStatus =
  | 'active'
  | 'invited'
  | 'suspended'
  | 'pending'
  | 'inactive';

export interface UserProfile {
  id: string;
  status?: string | null;
  user?: {
    email?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    isActive?: boolean | null;
    isVerified?: boolean | null;
  } | null;
  userTenantRole?: {
    role?: { name?: string | null; clearanceLevel?: number | null } | null;
  } | null;
}

const STATUS_META: Record<ProfileStatus, { label: string; tone: StateTone }> = {
  active: { label: 'Active', tone: 'success' },
  invited: { label: 'Invited', tone: 'info' },
  pending: { label: 'Pending', tone: 'info' },
  inactive: { label: 'Inactive', tone: 'neutral' },
  suspended: { label: 'Suspended', tone: 'warning' },
};

function statusKey(profile: UserProfile): ProfileStatus {
  const raw = String(
    profile.status ?? (profile.user?.isActive ? 'active' : 'inactive'),
  ).toLowerCase();
  if (raw in STATUS_META) return raw as ProfileStatus;
  return profile.user?.isActive === false ? 'inactive' : 'active';
}

function displayName(profile: UserProfile): string {
  const user = profile.user;
  return (
    [user?.firstName, user?.lastName].filter(Boolean).join(' ') ||
    user?.email ||
    'Unknown user'
  );
}

function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function roleName(profile: UserProfile): string {
  return profile.userTenantRole?.role?.name ?? 'No role';
}

export function UsersClient({ users }: { users: UserProfile[] }) {
  const [term, setTerm] = React.useState('');
  const [filters, setFilters] = React.useState<
    Record<string, string | null | undefined>
  >({});
  const [sort, setSort] = React.useState<DirectorySort | null>(null);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(DEFAULT_PAGE_SIZE);

  React.useEffect(() => setPage(1), [term, filters, pageSize]);

  const roles = React.useMemo(
    () => Array.from(new Set(users.map(roleName))).sort(),
    [users],
  );

  const columns: DirectoryColumn<UserProfile>[] = [
    {
      id: 'user',
      header: 'User',
      sortable: true,
      cell: (profile) => {
        const name = displayName(profile);
        return (
          <div className="flex items-center gap-3">
            <Avatar className="size-8">
              <AvatarFallback className="text-[calc(11px*var(--font-scale))] font-semibold">
                {initials(name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-col">
              <span className="break-words font-medium text-foreground">
                {name}
              </span>
              <span className="break-words text-xs text-muted-foreground">
                {profile.user?.email ?? 'No email'}
              </span>
            </div>
          </div>
        );
      },
    },
    {
      id: 'role',
      header: 'Role',
      hideable: true,
      cell: (profile) => (
        <span className="text-muted-foreground">{roleName(profile)}</span>
      ),
    },
    {
      id: 'verified',
      header: 'Verified',
      hideable: true,
      cell: (profile) => (
        <span className="text-muted-foreground">
          {profile.user?.isVerified ? 'Verified' : 'Unverified'}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      sortable: true,
      cell: (profile) => {
        const status = STATUS_META[statusKey(profile)];
        return (
          <StatusBadge tone={status.tone} dot>
            {status.label}
          </StatusBadge>
        );
      },
    },
  ];

  const filtered = React.useMemo(() => {
    const q = term.trim().toLowerCase();
    const status = filters.status;
    const role = filters.role;
    const verified = filters.verified;
    let out = users.filter((profile) => {
      const name = displayName(profile).toLowerCase();
      const email = (profile.user?.email ?? '').toLowerCase();
      const matchesQ = !q || name.includes(q) || email.includes(q);
      const matchesStatus = !status || statusKey(profile) === status;
      const matchesRole = !role || roleName(profile) === role;
      const matchesVerified =
        !verified ||
        (verified === 'verified'
          ? !!profile.user?.isVerified
          : !profile.user?.isVerified);
      return matchesQ && matchesStatus && matchesRole && matchesVerified;
    });
    if (sort) {
      const dir = sort.dir === 'desc' ? -1 : 1;
      out = [...out].sort((a, b) =>
        sort.field === 'status'
          ? dir * statusKey(a).localeCompare(statusKey(b))
          : dir * displayName(a).localeCompare(displayName(b)),
      );
    }
    return out;
  }, [users, term, filters, sort]);

  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const hasQuery = term.trim() !== '' || Object.values(filters).some(Boolean);

  return (
    <DirectoryTable<UserProfile>
      title="Users"
      description={`${filtered.length} ${filtered.length === 1 ? 'tenant profile' : 'tenant profiles'}`}
      columns={columns}
      rows={pageRows}
      getRowId={(p) => p.id}
      getRowLabel={displayName}
      total={filtered.length}
      page={page}
      pageSize={pageSize}
      onPageChange={setPage}
      onPageSizeChange={setPageSize}
      sort={sort}
      onSortChange={(field) =>
        setSort((cur) =>
          cur?.field !== field
            ? { field, dir: 'asc' }
            : cur.dir === 'asc'
              ? { field, dir: 'desc' }
              : null,
        )
      }
      caption="Tenant users"
      search={{
        value: term,
        onChange: setTerm,
        placeholder: 'Search name or email…',
        label: 'Search users',
        id: 'users-search',
      }}
      filters={[
        {
          key: 'status',
          label: 'Status',
          options: (Object.keys(STATUS_META) as ProfileStatus[]).map((k) => ({
            value: k,
            label: STATUS_META[k].label,
          })),
        },
        ...(roles.length > 0
          ? [
              {
                key: 'role',
                label: 'Role',
                options: roles.map((r) => ({ value: r, label: r })),
              },
            ]
          : []),
        {
          key: 'verified',
          label: 'Verification',
          options: [
            { value: 'verified', label: 'Verified' },
            { value: 'unverified', label: 'Unverified' },
          ],
        },
      ]}
      filterValues={filters}
      onFilterChange={(key, value) =>
        setFilters((f) => ({ ...f, [key]: value }))
      }
      onClearFilters={() => setFilters({})}
      emptyState={
        <EmptyState
          compact
          title={hasQuery ? 'No users match your filters' : 'No users found'}
          description={
            hasQuery
              ? 'Try a different search term, or clear the filters.'
              : 'Tenant users returned by the API will appear here.'
          }
        />
      }
    />
  );
}
