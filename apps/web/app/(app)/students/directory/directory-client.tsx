'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Bookmark, Download, Search, Trash2, UserPlus } from 'lucide-react';
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
import { PageHeader } from '@workspace/ui/custom/shell/page-header';
import { ShellMain } from '@workspace/ui/custom/shell/app-shell';
import { StatusBadge } from '@workspace/ui/custom/data-display/status-badge';
import { Meter } from '@workspace/ui/custom/data-display/meter';
import {
  DirectoryTable,
  MaskedValue,
  type DirectoryColumn,
  type DirectoryBulkAction,
} from '@workspace/ui/custom/tables/directory-table';
import { EmptyState } from '@workspace/ui/custom/states/page-states';
import { useDirectoryState } from '@workspace/ui/hooks/use-directory-state';
import type { DirectoryState } from '@workspace/ui/lib/directory-state';
import type { StateTone } from '@workspace/ui/types/states.types';

export interface StudentRow {
  id: string;
  studentNumber: string;
  name: string;
  gradeLevel: string | null;
  enrollmentStatus: string;
  className: string;
  guardian: string;
  contact: string;
  contactMasked: boolean;
  fee: { amountDue: number; amountPaid: number; status: FeeStatus };
}

export interface DirectorySavedView {
  id: string;
  name: string;
  state: Partial<DirectoryState>;
  isShared: boolean;
  ownerUserTenantId?: string;
}

type FeeStatus = 'paid' | 'partial' | 'owing' | 'none';

const ENROLLMENT_META: Record<string, { label: string; tone: StateTone }> = {
  active: { label: 'Active', tone: 'success' },
  inactive: { label: 'Inactive', tone: 'neutral' },
  suspended: { label: 'Suspended', tone: 'warning' },
  graduated: { label: 'Graduated', tone: 'info' },
  transferred: { label: 'Transferred', tone: 'neutral' },
  withdrawn: { label: 'Withdrawn', tone: 'destructive' },
};

const FEE_META: Record<FeeStatus, { label: string; tone: StateTone }> = {
  paid: { label: 'Paid', tone: 'success' },
  partial: { label: 'Part-paid', tone: 'info' },
  owing: { label: 'Owing', tone: 'destructive' },
  none: { label: 'No invoice', tone: 'neutral' },
};

const STATUS_OPTIONS = [
  'active',
  'inactive',
  'suspended',
  'graduated',
  'transferred',
  'withdrawn',
];

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

interface Props {
  rows: StudentRow[];
  total: number;
  schoolName: string;
  savedViews: DirectorySavedView[];
  currentProfileId: string | null;
  canExport: boolean;
  canViewContact: boolean;
}

export function StudentDirectoryClient({
  rows,
  total,
  schoolName,
  savedViews,
  currentProfileId,
  canExport,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const onChange = React.useCallback(
    (qs: string) => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname],
  );

  const defaults = React.useMemo(() => ({ pageSize: 25 }), []);
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
    defaults,
  });

  // Debounced search: keep typing snappy without a request per keystroke.
  const [term, setTerm] = React.useState(state.q);
  React.useEffect(() => setTerm(state.q), [state.q]);
  React.useEffect(() => {
    if (term === state.q) return;
    const id = setTimeout(() => setQuery(term), 300);
    return () => clearTimeout(id);
  }, [term, state.q, setQuery]);

  const appliedView = savedViews.find((v) => v.id === state.viewId) ?? null;
  const ownsAppliedView =
    !!appliedView &&
    !!currentProfileId &&
    appliedView.ownerUserTenantId === currentProfileId;

  async function handleExport(ids: string[]) {
    try {
      const res = await fetch('/api/directory/students/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
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
      toast.success(
        `Exported ${ids.length} student${ids.length === 1 ? '' : 's'}`,
      );
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

  const columns: DirectoryColumn<StudentRow>[] = [
    {
      id: 'name',
      header: 'Student',
      sortable: true,
      cell: (s) => (
        <div className="flex items-center gap-3">
          <Avatar className="size-8">
            <AvatarFallback seed={s.name} className="text-[11px] font-semibold">
              {initials(s.name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-col">
            <span className="break-words font-medium text-foreground">
              {s.name}
            </span>
            <span className="break-words text-xs text-muted-foreground">
              {s.studentNumber}
            </span>
          </div>
        </div>
      ),
    },
    {
      id: 'className',
      header: 'Class',
      cell: (s) => s.className,
      hideable: true,
    },
    {
      id: 'guardian',
      header: 'Guardian',
      cell: (s) => s.guardian,
      hideable: true,
    },
    {
      id: 'contact',
      header: 'Contact',
      cell: (s) => <MaskedValue value={s.contact} masked={s.contactMasked} />,
      hideable: true,
    },
    {
      id: 'status',
      header: 'Status',
      sortable: true,
      cell: (s) => {
        const meta = ENROLLMENT_META[s.enrollmentStatus] ?? {
          label: s.enrollmentStatus,
          tone: 'neutral' as StateTone,
        };
        return (
          <StatusBadge tone={meta.tone} dot>
            {meta.label}
          </StatusBadge>
        );
      },
    },
    {
      id: 'fees',
      header: 'Fees',
      cell: (s) => {
        const meta = FEE_META[s.fee.status];
        return (
          <div className="flex min-w-[7rem] flex-col gap-1">
            <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
            {s.fee.amountDue > 0 ? (
              <Meter
                value={s.fee.amountPaid}
                max={s.fee.amountDue}
                tone={s.fee.status === 'owing' ? 'destructive' : 'success'}
                hideValue
              />
            ) : null}
          </div>
        );
      },
      hideable: true,
    },
  ];

  const bulkActions: DirectoryBulkAction[] = canExport
    ? [
        {
          id: 'export',
          label: 'Export CSV',
          icon: <Download aria-hidden />,
          onRun: handleExport,
        },
      ]
    : [];

  const statusValue = state.filters.status ?? 'all';

  return (
    <ShellMain>
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Student directory"
          meta={[
            { key: 'school', label: schoolName, emphasis: true },
            { key: 'total', label: `${total} total` },
          ]}
          actions={
            <Button size="sm">
              <UserPlus /> Add student
            </Button>
          }
        />

        <DirectoryTable<StudentRow>
          title="Students"
          description={`${total} student${total === 1 ? '' : 's'} in ${schoolName}`}
          columns={columns}
          rows={rows}
          getRowId={(s) => s.id}
          getRowLabel={(s) => s.name}
          total={total}
          page={state.page}
          pageSize={state.pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          sort={state.sort}
          onSortChange={toggleSort}
          selectable
          bulkActions={bulkActions}
          caption="Student directory"
          emptyState={
            <EmptyState
              compact
              title="No students match this view"
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
                <Label htmlFor="student-search" className="sr-only">
                  Search students
                </Label>
                <Input
                  id="student-search"
                  type="search"
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  placeholder="Search name, number..."
                  className="pl-8"
                />
              </div>

              <Select
                value={statusValue}
                onValueChange={(v) =>
                  setFilter('status', v === 'all' ? null : v)
                }
              >
                <SelectTrigger
                  className="w-[8.5rem]"
                  aria-label="Filter by status"
                >
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {ENROLLMENT_META[s]?.label ?? s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

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
                  <SelectItem value="none">All students</SelectItem>
                  {savedViews.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name}
                      {v.isShared ? ' · shared' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <SaveViewButton state={state} onSaved={applyView} />

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
      </div>
    </ShellMain>
  );
}

/** "Save current view" — a small dialog capturing a name + share toggle. */
function SaveViewButton({
  state,
  onSaved,
}: {
  state: DirectoryState;
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
          resource: 'students',
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
