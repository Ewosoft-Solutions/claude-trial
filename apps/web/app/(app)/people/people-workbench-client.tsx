'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Bookmark,
  Briefcase,
  Download,
  GraduationCap,
  Search,
  Trash2,
  UserCog,
  UserPlus,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';

import { Avatar, AvatarFallback } from '@workspace/ui/components/avatar';
import { Button } from '@workspace/ui/components/button';
import { Checkbox } from '@workspace/ui/components/checkbox';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@workspace/ui/components/dialog';
import { Input } from '@workspace/ui/components/input';
import { Label } from '@workspace/ui/components/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select';
import { ShellMain } from '@workspace/ui/custom/shell/app-shell';
import { StatusBadge } from '@workspace/ui/custom/data-display/status-badge';
import { WorkbenchLayout } from '@workspace/ui/custom/workbench/workbench-layout';
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
import type { DirectoryState } from '@workspace/ui/lib/directory-state';
import type { WorkbenchTab } from '@workspace/ui/types/patterns.types';
import type { StateTone } from '@workspace/ui/types/states.types';

import {
  PEOPLE_TYPES,
  TAB_LABEL,
  TYPE_PERMISSION,
  type PeopleType,
} from './people-config';

export interface PeopleRow {
  id: string;
  name: string;
  contact: string;
  contactMasked: boolean;
  profiles: PeopleProfileKind[];
  primary: string;
  secondary: string;
  status: string | null;
}

export interface DirectorySavedView {
  id: string;
  name: string;
  state: Partial<DirectoryState>;
  isShared: boolean;
  ownerUserTenantId?: string;
}

type PeopleProfileKind = 'student' | 'guardian' | 'staff' | 'user';

const PROFILE_LABEL: Record<PeopleProfileKind, string> = {
  student: 'Student',
  guardian: 'Guardian',
  staff: 'Staff',
  user: 'User',
};

const TAB_ICON: Record<PeopleType, React.ReactNode> = {
  student: <GraduationCap />,
  guardian: <Users />,
  staff: <Briefcase />,
  user: <UserCog />,
  prospect: <UserPlus />,
};

/** Status value → chip label + tone, per tab. Distinct badges per lifecycle —
 *  never conflates account-enable with enrollment/employment (the C026 bug). */
const STATUS_META: Record<
  PeopleType,
  Record<string, { label: string; tone: StateTone }>
> = {
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
  user: {
    active: { label: 'Active', tone: 'success' },
    pending: { label: 'Pending', tone: 'info' },
    inactive: { label: 'Inactive', tone: 'neutral' },
    suspended: { label: 'Suspended', tone: 'destructive' },
  },
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

/** Per-tab status filter options (guardian has no status filter). */
const STATUS_OPTIONS: Record<PeopleType, string[]> = {
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
  guardian: [],
  prospect: ['pending', 'accepted', 'waitlisted', 'rejected'],
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
        <AvatarFallback seed={row.name} className="text-[11px] font-semibold">
          {initials(row.name)}
        </AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-col">
        <span className="break-words font-medium text-foreground">
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
    cell: (r) => <MaskedValue value={r.contact} masked={r.contactMasked} />,
    hideable: true,
  };
  const status: DirectoryColumn<PeopleRow> = {
    id: 'status',
    header:
      type === 'guardian'
        ? 'Priority'
        : type === 'prospect'
          ? 'Decision'
          : type === 'user'
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

interface Props {
  activeType: PeopleType;
  rows: PeopleRow[];
  total: number;
  schoolName: string;
  savedViews: DirectorySavedView[];
  currentProfileId: string | null;
  permissions: string[];
  authorized: boolean;
}

export function PeopleWorkbenchClient({
  activeType,
  rows,
  total,
  schoolName,
  savedViews,
  currentProfileId,
  permissions,
  authorized,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const has = React.useCallback(
    (permission: string) => permissions.includes(permission),
    [permissions],
  );

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
    defaults: React.useMemo(() => ({ pageSize: 25 }), []),
  });

  // Debounced search (snappy typing, one request per pause).
  const [term, setTerm] = React.useState(state.q);
  React.useEffect(() => setTerm(state.q), [state.q]);
  React.useEffect(() => {
    if (term === state.q) return;
    const id = setTimeout(() => setQuery(term), 300);
    return () => clearTimeout(id);
  }, [term, state.q, setQuery]);

  const tabs: WorkbenchTab[] = PEOPLE_TYPES.map((type) => ({
    key: type,
    label: TAB_LABEL[type],
    icon: TAB_ICON[type],
    disabled: !has(TYPE_PERMISSION[type]),
    badge: type === activeType ? total : undefined,
  }));

  function switchTab(key: string) {
    if (key === activeType) return;
    router.replace(`${pathname}?tab=${key}`, { scroll: false });
  }

  const appliedView = savedViews.find((v) => v.id === state.viewId) ?? null;
  const ownsAppliedView =
    !!appliedView &&
    !!currentProfileId &&
    appliedView.ownerUserTenantId === currentProfileId;

  const resource = `people-${activeType}`;

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

  async function deleteAppliedView() {
    if (!appliedView) return;
    try {
      const res = await fetch(`/api/directory/saved-views/${appliedView.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error(String(res.status));
      toast.success('View deleted');
      applyView(null, {});
      router.refresh();
    } catch {
      toast.error('Could not delete this view');
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

  const statusOptions = STATUS_OPTIONS[activeType];
  const statusValue = state.filters.status ?? 'all';

  const body = !authorized ? (
    <PermissionDeniedState
      title={`You can't view ${TAB_LABEL[activeType].toLowerCase()}`}
      description="Your role doesn't include this directory. Pick a tab you have access to, or ask an administrator."
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
      onPageSizeChange={setPageSize}
      sort={state.sort}
      onSortChange={toggleSort}
      selectable
      bulkActions={bulkActions}
      caption={`${TAB_LABEL[activeType]} directory`}
      emptyState={
        <EmptyState
          compact
          title={`No ${TAB_LABEL[activeType].toLowerCase()} match this view`}
          description="Adjust the search or filters, or clear the saved view to see everyone."
        />
      }
      toolbar={
        <>
          <div className="relative min-w-0 flex-1 @md/main:w-56 @md/main:flex-none">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Label htmlFor="people-search" className="sr-only">
              Search {TAB_LABEL[activeType].toLowerCase()}
            </Label>
            <Input
              id="people-search"
              type="search"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Search name, number..."
              className="pl-8"
            />
          </div>

          {statusOptions.length > 0 ? (
            <Select
              value={statusValue}
              onValueChange={(v) => setFilter('status', v === 'all' ? null : v)}
            >
              <SelectTrigger
                className="w-[9.5rem]"
                aria-label="Filter by status"
              >
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {statusOptions.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_META[activeType][s]?.label ?? s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}

          <Select
            value={state.viewId ?? 'none'}
            onValueChange={(v) => {
              if (v === 'none') {
                applyView(null, {});
                return;
              }
              const view = savedViews.find((sv) => sv.id === v);
              if (view) applyView(view.id, view.state);
            }}
          >
            <SelectTrigger className="w-[10rem]" aria-label="Saved views">
              <Bookmark className="size-3.5" aria-hidden />
              <SelectValue placeholder="Saved views" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">
                All {TAB_LABEL[activeType].toLowerCase()}
              </SelectItem>
              {savedViews.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.name}
                  {v.isShared ? ' · shared' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <SaveViewButton
            state={state}
            resource={resource}
            onSaved={applyView}
          />

          {ownsAppliedView ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={deleteAppliedView}
              aria-label="Delete this saved view"
            >
              <Trash2 aria-hidden />
            </Button>
          ) : null}
        </>
      }
    />
  );

  return (
    <ShellMain>
      <WorkbenchLayout
        title="People"
        description={`One identity per person across ${schoolName} — students, guardians, staff, users and prospects.`}
        tabs={tabs}
        activeTab={activeType}
        onTabChange={switchTab}
      >
        {body}
      </WorkbenchLayout>
    </ShellMain>
  );
}

/** "Save current view" — a small dialog capturing a name + share toggle. */
function SaveViewButton({
  state,
  resource,
  onSaved,
}: {
  state: DirectoryState;
  resource: string;
  onSaved: (viewId: string | null, viewState: Partial<DirectoryState>) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState('');
  const [shared, setShared] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const viewState: Partial<DirectoryState> = {
    q: state.q,
    filters: state.filters,
    sort: state.sort,
    pageSize: state.pageSize,
  };

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/directory/saved-views', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resource,
          name: name.trim(),
          state: viewState,
          isShared: shared,
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const created = (await res.json()) as { id: string };
      toast.success('View saved');
      setOpen(false);
      setName('');
      setShared(false);
      onSaved(created.id, viewState);
      router.refresh();
    } catch {
      toast.error('Could not save this view');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Bookmark aria-hidden /> Save view
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save current view</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="view-name">View name</Label>
            <Input
              id="view-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Owing — active"
              autoFocus
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={shared}
              onCheckedChange={(v) => setShared(v === true)}
            />
            Share with everyone at this school
          </label>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" size="sm">
              Cancel
            </Button>
          </DialogClose>
          <Button size="sm" onClick={save} disabled={saving || !name.trim()}>
            Save view
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
