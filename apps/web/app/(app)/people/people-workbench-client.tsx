'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Briefcase,
  Contact,
  Download,
  GraduationCap,
  UserCog,
  UserPlus,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';

import { Avatar, AvatarFallback } from '@workspace/ui/components/avatar';
import { ShellMain } from '@workspace/ui/custom/shell/app-shell';
import { StatusBadge } from '@workspace/ui/custom/data-display/status-badge';
import { StatGrid } from '@workspace/ui/custom/layouts/stat-grid';
import { WorkbenchLayout } from '@workspace/ui/custom/workbench/workbench-layout';
import type { StatItem } from '@workspace/ui/types/layout.types';
import {
  DirectoryTable,
  MaskedValue,
  type DirectoryColumn,
  type DirectoryBulkAction,
} from '@workspace/ui/custom/tables/directory-table';
import {
  EmptyState,
  PermissionDeniedState,
} from '@workspace/ui/custom/states/page-states';
import { useDirectoryState } from '@workspace/ui/hooks/use-directory-state';

import { DEFAULT_PAGE_SIZE, savePageSizePreference } from '@/lib/page-size';
import type { StateTone } from '@workspace/ui/types/states.types';

import { PEOPLE_TYPES, TAB_LABEL, type PeopleType } from './people-config';
import { PersonDetailDrawer } from './person-detail-drawer';

export interface PeopleRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  contactMasked: boolean;
  profiles: PeopleProfileKind[];
  primary: string;
  secondary: string;
  status: string | null;
}

/** Distinct filter option lists resolved server-side (per tenant). */
export interface PeopleFacets {
  grades: string[];
  departments: string[];
}

type PeopleProfileKind = 'student' | 'guardian' | 'staff' | 'user';

const PROFILE_LABEL: Record<PeopleProfileKind, string> = {
  student: 'Student',
  guardian: 'Guardian',
  staff: 'Staff',
  user: 'User',
};

const TYPE_ICON: Record<PeopleType, React.ReactNode> = {
  all: <Contact />,
  student: <GraduationCap />,
  guardian: <Users />,
  staff: <Briefcase />,
  user: <UserCog />,
  prospect: <UserPlus />,
};

/** Status value → chip label + tone, per tab. Distinct badges per lifecycle —
 *  never conflates account-enable with enrollment/employment (the C026 bug). */
const ACCOUNT_STATUS_META: Record<string, { label: string; tone: StateTone }> =
  {
    active: { label: 'Active', tone: 'success' },
    pending: { label: 'Pending', tone: 'info' },
    inactive: { label: 'Inactive', tone: 'neutral' },
    suspended: { label: 'Suspended', tone: 'destructive' },
  };

const STATUS_META: Record<
  PeopleType,
  Record<string, { label: string; tone: StateTone }>
> = {
  all: ACCOUNT_STATUS_META,
  student: {
    active: { label: 'Active', tone: 'success' },
    inactive: { label: 'Inactive', tone: 'neutral' },
    suspended: { label: 'Suspended', tone: 'warning' },
    graduated: { label: 'Graduated', tone: 'info' },
    transferred: { label: 'Transferred', tone: 'neutral' },
    withdrawn: { label: 'Withdrawn', tone: 'destructive' },
  },
  staff: {
    active: { label: 'Active', tone: 'success' },
    on_leave: { label: 'On leave', tone: 'warning' },
    suspended: { label: 'Suspended', tone: 'warning' },
    terminated: { label: 'Terminated', tone: 'destructive' },
  },
  user: ACCOUNT_STATUS_META,
  guardian: {
    primary: { label: 'Primary contact', tone: 'info' },
    secondary: { label: 'Secondary', tone: 'neutral' },
  },
  prospect: {
    pending: { label: 'Pending', tone: 'info' },
    accepted: { label: 'Accepted', tone: 'success' },
    waitlisted: { label: 'Waitlisted', tone: 'warning' },
    rejected: { label: 'Rejected', tone: 'destructive' },
  },
};

/** Per-tab status/priority filter options (now filled for every tab). */
const STATUS_OPTIONS: Record<PeopleType, string[]> = {
  all: ['active', 'pending', 'inactive', 'suspended'],
  student: [
    'active',
    'inactive',
    'suspended',
    'graduated',
    'transferred',
    'withdrawn',
  ],
  staff: ['active', 'on_leave', 'suspended', 'terminated'],
  user: ['active', 'pending', 'inactive', 'suspended'],
  guardian: ['primary', 'secondary'],
  prospect: ['pending', 'accepted', 'waitlisted', 'rejected'],
};

/** The label the status filter carries on each tab. */
const STATUS_FILTER_LABEL: Record<PeopleType, string> = {
  all: 'Account',
  student: 'Enrollment',
  staff: 'Employment',
  user: 'Account',
  guardian: 'Priority',
  prospect: 'Decision',
};

function initials(name: string): string {
  return (
    name
      .split(' ')
      .slice(0, 2)
      .map((p) => p[0])
      .join('')
      .toUpperCase() || '?'
  );
}

function statusChip(type: PeopleType, status: string | null) {
  if (!status) return <span className="text-muted-foreground">—</span>;
  const meta = STATUS_META[type][status] ?? {
    label: status,
    tone: 'neutral' as StateTone,
  };
  return (
    <StatusBadge tone={meta.tone} dot>
      {meta.label}
    </StatusBadge>
  );
}

/** The name cell: avatar + name, with the identity's other profiles beneath. */
function NameCell({ row }: { row: PeopleRow }) {
  return (
    <div className="flex items-center gap-3">
      <Avatar className="size-8">
        <AvatarFallback
          seed={row.name}
          className="text-[calc(11px*var(--font-scale))] font-semibold"
        >
          {initials(row.name)}
        </AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-col">
        <span className="break-words font-medium capitalize text-foreground">
          {row.name}
        </span>
        {row.profiles.length > 0 ? (
          <span className="break-words text-xs text-muted-foreground">
            {row.profiles.map((p) => PROFILE_LABEL[p]).join(' · ')}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/** The contact cell: primary email + phone, each masked-aware. */
function ContactCell({ row }: { row: PeopleRow }) {
  if (!row.email && !row.phone) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <div className="flex flex-col gap-0.5 text-sm">
      {row.email ? (
        <MaskedValue value={row.email} masked={row.contactMasked} />
      ) : null}
      {row.phone ? (
        <MaskedValue value={row.phone} masked={row.contactMasked} />
      ) : null}
    </div>
  );
}

/** Build the column set for a tab. All read the same PeopleRow shape. */
function columnsFor(type: PeopleType): DirectoryColumn<PeopleRow>[] {
  const name: DirectoryColumn<PeopleRow> = {
    id: 'name',
    header: type === 'prospect' ? 'Applicant' : 'Person',
    sortable: true,
    cell: (r) => <NameCell row={r} />,
  };
  const contact: DirectoryColumn<PeopleRow> = {
    id: 'contact',
    header: 'Contact',
    cell: (r) => <ContactCell row={r} />,
    hideable: true,
  };
  const status: DirectoryColumn<PeopleRow> = {
    id: 'status',
    header:
      type === 'guardian'
        ? 'Priority'
        : type === 'prospect'
          ? 'Decision'
          : type === 'user' || type === 'all'
            ? 'Account'
            : type === 'staff'
              ? 'Employment'
              : 'Enrollment',
    cell: (r) => statusChip(type, r.status),
  };

  const primary = (header: string): DirectoryColumn<PeopleRow> => ({
    id: 'primary',
    header,
    cell: (r) => r.primary,
    hideable: true,
  });
  const secondary = (header: string): DirectoryColumn<PeopleRow> => ({
    id: 'secondary',
    header,
    cell: (r) => r.secondary,
    hideable: true,
  });

  switch (type) {
    case 'all':
      return [name, status, contact];
    case 'student':
      return [
        name,
        primary('Student no.'),
        secondary('Grade'),
        status,
        contact,
      ];
    case 'staff':
      return [name, primary('Role'), secondary('Department'), status, contact];
    case 'guardian':
      return [name, primary('Wards'), secondary('Ward names'), status, contact];
    case 'user':
      return [name, status, contact];
    case 'prospect':
      return [
        name,
        primary('Applying for'),
        secondary('Guardian'),
        status,
        contact,
      ];
  }
}

/** A single toolbar filter dropdown. */
interface FilterDef {
  key: 'status' | 'role' | 'grade' | 'department' | 'hasContact';
  label: string;
  allLabel: string;
  options: { value: string; label: string }[];
}

/** The filters a given tab offers (status/priority + the tab-specific extras). */
function filtersFor(type: PeopleType, facets: PeopleFacets): FilterDef[] {
  const defs: FilterDef[] = [];

  const statusOptions = STATUS_OPTIONS[type];
  if (statusOptions.length > 0) {
    const label = STATUS_FILTER_LABEL[type];
    defs.push({
      key: 'status',
      label,
      allLabel: `All ${label.toLowerCase()}`,
      options: statusOptions.map((s) => ({
        value: s,
        label: STATUS_META[type][s]?.label ?? s,
      })),
    });
  }

  if (type === 'all') {
    defs.push({
      key: 'role',
      label: 'Role',
      allLabel: 'All roles',
      options: [
        { value: 'student', label: 'Students' },
        { value: 'guardian', label: 'Guardians' },
        { value: 'staff', label: 'Staff' },
        { value: 'user', label: 'Users' },
      ],
    });
  }

  if (type === 'student' && facets.grades.length > 0) {
    defs.push({
      key: 'grade',
      label: 'Grade',
      allLabel: 'All grades',
      options: facets.grades.map((g) => ({ value: g, label: g })),
    });
  }

  if (type === 'staff' && facets.departments.length > 0) {
    defs.push({
      key: 'department',
      label: 'Department',
      allLabel: 'All departments',
      options: facets.departments.map((d) => ({ value: d, label: d })),
    });
  }

  if (type !== 'prospect') {
    defs.push({
      key: 'hasContact',
      label: 'Contact',
      allLabel: 'Any contact',
      options: [
        { value: 'true', label: 'Has contact' },
        { value: 'false', label: 'No contact' },
      ],
    });
  }

  return defs;
}

interface Props {
  activeType: PeopleType;
  rows: PeopleRow[];
  total: number;
  schoolName: string;
  authorized: boolean;
  /** Per-tab record counts for the summary cards (only authorized tabs). */
  summary?: Record<string, number>;
  /** Distinct grade / department option lists for the filters. */
  facets?: PeopleFacets;
  /** The user's saved rows-per-page preference (from the cookie). */
  defaultPageSize?: number;
}

export function PeopleWorkbenchClient({
  activeType,
  rows,
  total,
  schoolName,
  authorized,
  summary = {},
  facets = { grades: [], departments: [] },
  defaultPageSize = DEFAULT_PAGE_SIZE,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Directory state lives in the URL alongside `tab`; re-attach the tab on every
  // state change so the active projection is preserved through filter/sort/page.
  const onChange = React.useCallback(
    (qs: string) => {
      const next = qs
        ? `${pathname}?tab=${activeType}&${qs}`
        : `${pathname}?tab=${activeType}`;
      router.replace(next, { scroll: false });
    },
    [router, pathname, activeType],
  );

  const {
    state,
    setPage,
    setPageSize,
    toggleSort,
    setQuery,
    setFilter,
    applyView,
  } = useDirectoryState({
    searchParams: searchParams.toString(),
    onChange,
    defaults: React.useMemo(
      () => ({ pageSize: defaultPageSize }),
      [defaultPageSize],
    ),
  });

  // Changing the page size updates the URL AND saves the choice (cookie + the
  // per-account record), so the preference follows the user across every table
  // and every device.
  const changePageSize = React.useCallback(
    (size: number) => {
      savePageSizePreference(size);
      setPageSize(size);
    },
    [setPageSize],
  );

  // Debounced search (snappy typing, one request per pause).
  const [term, setTerm] = React.useState(state.q);
  React.useEffect(() => setTerm(state.q), [state.q]);
  React.useEffect(() => {
    if (term === state.q) return;
    const id = setTimeout(() => setQuery(term), 300);
    return () => clearTimeout(id);
  }, [term, state.q, setQuery]);

  function switchTab(key: string) {
    if (key === activeType) return;
    router.replace(`${pathname}?tab=${key}`, { scroll: false });
  }

  // Summary cards double as the TYPE SELECTOR (the tab strip is retired). One
  // per authorized tab; the active tab's card is highlighted.
  const statItems: StatItem[] = PEOPLE_TYPES.filter(
    (type) => summary?.[type] !== undefined,
  ).map((type) => ({
    key: type,
    label: TAB_LABEL[type],
    value: (summary?.[type] ?? 0).toLocaleString(),
    icon: TYPE_ICON[type],
    active: type === activeType,
    onSelect: () => switchTab(type),
  }));

  // Row drill-in.
  const [openId, setOpenId] = React.useState<string | null>(null);

  const filters = filtersFor(activeType, facets);

  function clearFilters() {
    setTerm('');
    // Reset q + filters in one commit, preserving sort + page size.
    applyView(null, { sort: state.sort, pageSize: state.pageSize });
  }

  async function handleExport(ids: string[]) {
    try {
      const res = await fetch('/api/directory/people/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: activeType, ids }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const { filename, content, mimeType } = (await res.json()) as {
        filename: string;
        content: string;
        mimeType: string;
      };
      const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${ids.length} row${ids.length === 1 ? '' : 's'}`);
    } catch {
      toast.error('Export failed. Please try again.');
    }
  }

  const bulkActions: DirectoryBulkAction[] = [
    {
      id: 'export',
      label: 'Export CSV',
      icon: <Download aria-hidden />,
      onRun: handleExport,
    },
  ];

  const body = !authorized ? (
    <PermissionDeniedState
      title={`You can't view ${TAB_LABEL[activeType].toLowerCase()}`}
      description="Your role doesn't include this directory. Pick a card you have access to, or ask an administrator."
    />
  ) : (
    <DirectoryTable<PeopleRow>
      title={TAB_LABEL[activeType]}
      description={`${total} ${total === 1 ? 'record' : 'records'} in ${schoolName}`}
      columns={columnsFor(activeType)}
      rows={rows}
      getRowId={(r) => r.id}
      getRowLabel={(r) => r.name}
      total={total}
      page={state.page}
      pageSize={state.pageSize}
      onPageChange={setPage}
      onPageSizeChange={changePageSize}
      sort={state.sort}
      onSortChange={toggleSort}
      selectable
      bulkActions={bulkActions}
      onRowClick={(r) => setOpenId(r.id)}
      caption={`${TAB_LABEL[activeType]} directory`}
      emptyState={
        <EmptyState
          compact
          title={`No ${TAB_LABEL[activeType].toLowerCase()} match this view`}
          description="Adjust the search or filters to see more."
        />
      }
      search={{
        value: term,
        onChange: setTerm,
        placeholder: 'Search name, number...',
        label: `Search ${TAB_LABEL[activeType].toLowerCase()}`,
        id: 'people-search',
      }}
      filters={filters.map((def) => ({
        key: def.key,
        label: def.label,
        options: def.options,
      }))}
      filterValues={state.filters}
      onFilterChange={setFilter}
      onClearFilters={clearFilters}
    />
  );

  return (
    <ShellMain>
      <WorkbenchLayout
        title="People"
        description={`One identity per person across ${schoolName} — students, guardians, staff, users and prospects.`}
        tabs={[]}
        activeTab={activeType}
      >
        <div className="flex flex-col gap-4">
          {statItems.length > 0 ? (
            <StatGrid items={statItems} minTileWidth={150} />
          ) : null}
          {body}
        </div>
      </WorkbenchLayout>

      <PersonDetailDrawer
        personId={openId}
        type={activeType}
        onOpenChange={(open) => {
          if (!open) setOpenId(null);
        }}
        onOpenPerson={(id) => setOpenId(id)}
      />
    </ShellMain>
  );
}
