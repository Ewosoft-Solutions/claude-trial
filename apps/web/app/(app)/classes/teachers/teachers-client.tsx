'use client';

import * as React from 'react';
import { Plus, UserMinus, Users } from 'lucide-react';

import { useViewer } from '@/app/providers/viewer-provider';
import {
  academicsApi,
  classLabel,
  formatDate,
  initials,
  personName,
  readError,
  type ClassSummary,
  type ClassTeacherAssignment,
  type StaffProfile,
} from '@/lib/academics';
import { Avatar, AvatarFallback } from '@workspace/ui/components/avatar';
import { Button } from '@workspace/ui/components/button';
import { Label } from '@workspace/ui/components/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select';
import { StatusBadge } from '@workspace/ui/custom/data-display/status-badge';
import {
  DirectoryTable,
  type DirectoryColumn,
} from '@workspace/ui/custom/tables/directory-table';
import type { DirectorySort } from '@workspace/ui/lib/directory-state';
import { ShellMain } from '@workspace/ui/custom/shell/app-shell';
import { DEFAULT_PAGE_SIZE } from '@/lib/page-size';
import { PageHeader } from '@workspace/ui/custom/shell/page-header';
import { NoticeBanner } from '@workspace/ui/custom/states/notice-banner';
import { EmptyState } from '@workspace/ui/custom/states/page-states';

type TeacherRole = 'teacher' | 'assistant' | 'co-teacher' | 'substitute';

const ROLE_OPTIONS: Array<{ value: TeacherRole; label: string }> = [
  { value: 'teacher', label: 'Teacher' },
  { value: 'assistant', label: 'Assistant' },
  { value: 'co-teacher', label: 'Co-teacher' },
  { value: 'substitute', label: 'Substitute' },
];

export function ClassTeachersClient({
  live,
  initialClasses,
  initialStaff,
  initialAssignments,
}: {
  live: boolean;
  initialClasses: ClassSummary[];
  initialStaff: StaffProfile[];
  initialAssignments: Record<string, ClassTeacherAssignment[]>;
}) {
  const { viewer } = useViewer();
  const canAssign = viewer.permissions.has('classes.teachers.assign');

  const [classId, setClassId] = React.useState(initialClasses[0]?.id ?? '');
  const [assignmentsByClass, setAssignmentsByClass] =
    React.useState(initialAssignments);
  const [staffId, setStaffId] = React.useState('');
  const [role, setRole] = React.useState<TeacherRole>('teacher');
  const [term, setTerm] = React.useState('');
  const [filters, setFilters] = React.useState<
    Record<string, string | null | undefined>
  >({});
  const [sort, setSort] = React.useState<DirectorySort | null>(null);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(DEFAULT_PAGE_SIZE);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => setPage(1), [term, filters, pageSize, classId]);

  const assignments = React.useMemo(
    () => assignmentsByClass[classId] ?? [],
    [assignmentsByClass, classId],
  );
  const selectedClass =
    initialClasses.find((cls) => cls.id === classId) ?? null;
  const activeAssignments = assignments.filter(
    (assignment) => assignment.isActive,
  );
  const activeStaffIds = new Set(
    activeAssignments.map((assignment) => assignment.userTenantId),
  );
  const availableStaff = initialStaff.filter(
    (profile) => !activeStaffIds.has(profile.id),
  );

  const filtered = React.useMemo(() => {
    const q = term.trim().toLowerCase();
    const status = filters.status;
    const roleFilter = filters.role;
    let out = assignments.filter((a) => {
      const name = personName(a.userTenant).toLowerCase();
      const email = a.userTenant.user.email.toLowerCase();
      const matchesQ = !q || name.includes(q) || email.includes(q);
      const matchesStatus =
        !status || (status === 'active' ? a.isActive : !a.isActive);
      const matchesRole = !roleFilter || a.role === roleFilter;
      return matchesQ && matchesStatus && matchesRole;
    });
    if (sort) {
      const dir = sort.dir === 'desc' ? -1 : 1;
      out = [...out].sort((a, b) =>
        sort.field === 'assignedAt'
          ? dir * a.assignedAt.localeCompare(b.assignedAt)
          : sort.field === 'status'
            ? dir * (Number(a.isActive) - Number(b.isActive))
            : dir *
              personName(a.userTenant).localeCompare(personName(b.userTenant)),
      );
    }
    return out;
  }, [assignments, term, filters, sort]);

  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  const columns: DirectoryColumn<ClassTeacherAssignment>[] = [
    {
      id: 'teacher',
      header: 'Teacher',
      sortable: true,
      cell: (a) => {
        const name = personName(a.userTenant);
        return (
          <div className="flex items-center gap-3">
            <Avatar className="size-8">
              <AvatarFallback className="text-[11px] font-semibold">
                {initials(name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="break-words font-medium">{name}</p>
              <p className="break-words text-xs text-muted-foreground">
                {a.userTenant.user.email}
              </p>
            </div>
          </div>
        );
      },
    },
    {
      id: 'role',
      header: 'Allocation',
      hideable: true,
      cell: (a) => (
        <span className="capitalize">{a.role.replace('-', ' ')}</span>
      ),
    },
    {
      id: 'assignedAt',
      header: 'Assigned',
      sortable: true,
      hideable: true,
      cell: (a) => (
        <span className="text-muted-foreground">
          {formatDate(a.assignedAt)}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      sortable: true,
      cell: (a) => (
        <StatusBadge tone={a.isActive ? 'success' : 'neutral'} dot={a.isActive}>
          {a.isActive ? 'Active' : 'Ended'}
        </StatusBadge>
      ),
    },
    ...(canAssign
      ? ([
          {
            id: 'actions',
            header: 'Actions',
            align: 'end',
            cell: (a: ClassTeacherAssignment) =>
              a.isActive ? (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Unassign ${personName(a.userTenant)}`}
                  onClick={() => void unassignTeacher(a.userTenantId)}
                  disabled={!live || busy}
                >
                  <UserMinus />
                </Button>
              ) : null,
          },
        ] as DirectoryColumn<ClassTeacherAssignment>[])
      : []),
  ];

  function patchAssignments(next: ClassTeacherAssignment[]) {
    setAssignmentsByClass((prev) => ({ ...prev, [classId]: next }));
  }

  async function assignTeacher() {
    if (!classId || !staffId || !live || !canAssign) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(academicsApi(`classes/${classId}/teachers`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userTenantId: staffId, role }),
      });
      if (!res.ok) throw new Error(await readError(res));
      const assignment = (await res.json()) as ClassTeacherAssignment;
      patchAssignments([
        assignment,
        ...assignments.filter((item) => item.id !== assignment.id),
      ]);
      setStaffId('');
      setRole('teacher');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Assignment failed');
    } finally {
      setBusy(false);
    }
  }

  async function unassignTeacher(userTenantId: string) {
    if (!classId || !live || !canAssign) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        academicsApi(`classes/${classId}/teachers/${userTenantId}`),
        { method: 'DELETE' },
      );
      if (!res.ok) throw new Error(await readError(res));
      const updated = (await res.json()) as ClassTeacherAssignment;
      patchAssignments(
        assignments.map((item) =>
          item.id === updated.id ? { ...item, ...updated } : item,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unassignment failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ShellMain>
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Teacher allocation"
          meta={[
            {
              key: 'class',
              label: selectedClass
                ? classLabel(selectedClass)
                : 'No class selected',
              emphasis: true,
            },
            { key: 'active', label: `${activeAssignments.length} active` },
          ]}
        />

        {error ? (
          <NoticeBanner
            tone="destructive"
            title="Something went wrong"
            description={error}
            onDismiss={() => setError(null)}
          />
        ) : null}

        <div className="grid gap-4 rounded-lg border bg-card p-4 @5xl/main:grid-cols-[minmax(18rem,24rem)_1fr]">
          <div className="grid gap-2">
            <Label htmlFor="allocation-class">Class</Label>
            <Select value={classId} onValueChange={setClassId}>
              <SelectTrigger id="allocation-class" aria-label="Select class">
                <SelectValue placeholder="Select class" />
              </SelectTrigger>
              <SelectContent>
                {initialClasses.map((cls) => (
                  <SelectItem key={cls.id} value={cls.id}>
                    {classLabel(cls)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {canAssign ? (
            <div className="grid gap-3 @3xl/main:grid-cols-[minmax(12rem,1fr)_10rem_auto] @3xl/main:items-end">
              <div className="grid gap-2">
                <Label htmlFor="teacher-profile">Teacher</Label>
                <Select value={staffId} onValueChange={setStaffId}>
                  <SelectTrigger
                    id="teacher-profile"
                    aria-label="Select teacher"
                  >
                    <SelectValue placeholder="Select teacher" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableStaff.map((profile) => (
                      <SelectItem key={profile.id} value={profile.id}>
                        {personName(profile)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="teacher-role">Role</Label>
                <Select
                  value={role}
                  onValueChange={(value) => setRole(value as TeacherRole)}
                >
                  <SelectTrigger id="teacher-role" aria-label="Select role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={() => void assignTeacher()}
                disabled={!live || busy || !staffId}
              >
                <Plus /> Assign
              </Button>
            </div>
          ) : null}
        </div>

        <DirectoryTable<ClassTeacherAssignment>
          title="Class roster"
          description={`${filtered.length} allocation records`}
          columns={columns}
          rows={pageRows}
          getRowId={(a) => a.id}
          getRowLabel={(a) => personName(a.userTenant)}
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
          caption="Class teacher roster"
          search={{
            value: term,
            onChange: setTerm,
            placeholder: 'Search teachers',
            label: 'Search teachers',
            id: 'allocation-search',
          }}
          filters={[
            {
              key: 'status',
              label: 'Status',
              options: [
                { value: 'active', label: 'Active' },
                { value: 'ended', label: 'Ended' },
              ],
            },
            {
              key: 'role',
              label: 'Role',
              options: ROLE_OPTIONS.map((r) => ({
                value: r.value,
                label: r.label,
              })),
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
              icon={<Users aria-hidden />}
              title="No allocations"
              description="No teachers match the current class and search."
            />
          }
        />
      </div>
    </ShellMain>
  );
}
