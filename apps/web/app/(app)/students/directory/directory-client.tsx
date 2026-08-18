'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Download, UserPlus } from 'lucide-react';
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
} from '@workspace/ui/components/dialog';
import { Input } from '@workspace/ui/components/input';
import { Label } from '@workspace/ui/components/label';
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

import { PersonDetailDrawer } from '@/app/(app)/people/person-detail-drawer';
import { useDirectoryState } from '@workspace/ui/hooks/use-directory-state';

import { DEFAULT_PAGE_SIZE, savePageSizePreference } from '@/lib/page-size';
import type { DirectoryState } from '@workspace/ui/lib/directory-state';
import type { StateTone } from '@workspace/ui/types/states.types';

export interface StudentRow {
  id: string;
  /**
   * The Person behind this student (F1), when the link exists. Drives the
   * shared detail drawer; null for records whose `Student.personId` was never
   * back-filled, which simply have no drill-in.
   */
  personId: string | null;
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

const STATUS_FILTER_OPTIONS = STATUS_OPTIONS.map((s) => ({
  value: s,
  label: ENROLLMENT_META[s]?.label ?? s,
}));

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
  /** The user's saved rows-per-page preference (from the cookie). */
  defaultPageSize?: number;
}

export function StudentDirectoryClient({
  rows,
  total,
  schoolName,
  savedViews,
  currentProfileId,
  canExport,
  defaultPageSize = DEFAULT_PAGE_SIZE,
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

  const defaults = React.useMemo(
    () => ({ pageSize: defaultPageSize }),
    [defaultPageSize],
  );
  const {
    state,
    setPage,
    setPageSize,
    toggleSort,
    setQuery,
    setFilter,
    setFilters,
    setHiddenColumns,
    applyView,
  } = useDirectoryState({
    searchParams: searchParams.toString(),
    onChange,
    defaults,
  });

  // Save the chosen size to the cookie + the account, so it follows the user
  // across every table and every device.
  const changePageSize = React.useCallback(
    (size: number) => {
      savePageSizePreference(size);
      setPageSize(size);
    },
    [setPageSize],
  );

  // Debounced search: keep typing snappy without a request per keystroke.
  const [term, setTerm] = React.useState(state.q);
  React.useEffect(() => setTerm(state.q), [state.q]);
  React.useEffect(() => {
    if (term === state.q) return;
    const id = setTimeout(() => setQuery(term), 300);
    return () => clearTimeout(id);
  }, [term, state.q, setQuery]);

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

  async function deleteView(id: string) {
    try {
      const res = await fetch(`/api/directory/saved-views/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error(String(res.status));
      toast.success('View deleted');
      if (state.viewId === id) applyView(null, {});
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
            <AvatarFallback
              seed={s.name}
              className="text-[calc(11px*var(--font-scale))] font-semibold"
            >
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
      // Machine-generated student emails run very long; clamp + tooltip so one
      // address cannot widen the table past the status/fees columns.
      truncate: true,
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

  const [saveViewOpen, setSaveViewOpen] = React.useState(false);
  /** Person behind the row being drilled into; null closes the drawer. */
  const [openPersonId, setOpenPersonId] = React.useState<string | null>(null);

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
          onPageSizeChange={changePageSize}
          sort={state.sort}
          onSortChange={toggleSort}
          selectable
          bulkActions={bulkActions}
          // Rows without a back-filled person have no detail to open; leaving
          // them un-clickable is honest, rather than opening an empty drawer.
          onRowClick={(s) => {
            if (s.personId) setOpenPersonId(s.personId);
          }}
          isRowClickable={(s) => Boolean(s.personId)}
          caption="Student directory"
          emptyState={
            <EmptyState
              compact
              title="No students match this view"
              description="Adjust the search or filters, or clear the saved view to see everyone."
            />
          }
          search={{
            value: term,
            onChange: setTerm,
            placeholder: 'Search name, number...',
            label: 'Search students',
            id: 'student-search',
          }}
          filters={[
            { key: 'status', label: 'Status', options: STATUS_FILTER_OPTIONS },
          ]}
          filterValues={state.filters}
          onFilterChange={setFilter}
          onClearFilters={() => setFilters({})}
          hiddenColumns={state.hiddenColumns}
          onHiddenColumnsChange={setHiddenColumns}
          views={{
            options: savedViews.map((v) => ({
              id: v.id,
              name: v.name,
              shared: v.isShared,
              canDelete:
                !!currentProfileId && v.ownerUserTenantId === currentProfileId,
            })),
            currentId: state.viewId ?? null,
            allLabel: 'All students',
            onSelect: (id) => {
              if (id == null) {
                applyView(null, {});
                return;
              }
              const view = savedViews.find((sv) => sv.id === id);
              if (view) applyView(view.id, view.state);
            },
            onSave: () => setSaveViewOpen(true),
            onDelete: (id) => deleteView(id),
          }}
        />

        <SaveViewDialog
          open={saveViewOpen}
          onOpenChange={setSaveViewOpen}
          state={state}
          onSaved={applyView}
        />
      </div>

      {/* The SAME governed drawer the People workbench opens for a student.
          Reused rather than rebuilt so the layered access rules (Finance on
          `finance.view`, staff detail on `staff.view`, guardian detail on
          `guardians.view`, contact masked without `people.view_contact`) stay
          enforced in ONE place on the server — duplicating them here is how a
          teacher ends up seeing a fee balance. */}
      <PersonDetailDrawer
        personId={openPersonId}
        type="student"
        onOpenChange={(open) => {
          if (!open) setOpenPersonId(null);
        }}
        onOpenPerson={(id) => setOpenPersonId(id)}
      />
    </ShellMain>
  );
}

/** "Save current view" — a controlled dialog capturing a name + share toggle.
 *  Triggered from the toolbar's "Save view" control (see `views.onSave`). */
function SaveViewDialog({
  open,
  onOpenChange,
  state,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: DirectoryState;
  onSaved: (viewId: string | null, viewState: Partial<DirectoryState>) => void;
}) {
  const router = useRouter();
  const [name, setName] = React.useState('');
  const [shared, setShared] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const viewState: Partial<DirectoryState> = {
    q: state.q,
    filters: state.filters,
    sort: state.sort,
    pageSize: state.pageSize,
    // Capture which columns are hidden so the view can omit columns that aren't
    // relevant to it (restored on apply; empty = every column shown).
    hiddenColumns: state.hiddenColumns,
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
      onOpenChange(false);
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
    <Dialog open={open} onOpenChange={onOpenChange}>
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
