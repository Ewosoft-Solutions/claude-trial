'use client';

import * as React from 'react';
import { Plus, Search, UserMinus, Users } from 'lucide-react';

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
import { Input } from '@workspace/ui/components/input';
import { Label } from '@workspace/ui/components/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@workspace/ui/components/table';
import { StatusBadge } from '@workspace/ui/custom/data-display/status-badge';
import { DataTableLayout } from '@workspace/ui/custom/layouts/data-table-layout';
import { ShellMain } from '@workspace/ui/custom/shell/app-shell';
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
  const [query, setQuery] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const assignments = React.useMemo(
    () => assignmentsByClass[classId] ?? [],
    [assignmentsByClass, classId],
  );
  const selectedClass = initialClasses.find((cls) => cls.id === classId) ?? null;
  const activeAssignments = assignments.filter((assignment) => assignment.isActive);
  const activeStaffIds = new Set(
    activeAssignments.map((assignment) => assignment.userTenantId),
  );
  const availableStaff = initialStaff.filter(
    (profile) => !activeStaffIds.has(profile.id),
  );

  const filteredAssignments = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return assignments;
    return assignments.filter((assignment) => {
      const name = personName(assignment.userTenant).toLowerCase();
      const email = assignment.userTenant.user.email.toLowerCase();
      return name.includes(needle) || email.includes(needle);
    });
  }, [assignments, query]);

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
              label: selectedClass ? classLabel(selectedClass) : 'No class selected',
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
                  <SelectTrigger id="teacher-profile" aria-label="Select teacher">
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

        <DataTableLayout
          title="Class roster"
          description={`${filteredAssignments.length} allocation records`}
          empty={filteredAssignments.length === 0}
          toolbar={
            <div className="relative flex-1 min-w-0 @md/main:w-64 @md/main:flex-none">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Label htmlFor="allocation-search" className="sr-only">
                Search teachers
              </Label>
              <Input
                id="allocation-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search teachers"
                className="pl-8"
              />
            </div>
          }
          emptyState={
            <EmptyState
              compact
              icon={<Users aria-hidden />}
              title="No allocations"
              description="No teachers match the current class and search."
            />
          }
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Teacher</TableHead>
                <TableHead>Allocation</TableHead>
                <TableHead className="max-md:hidden">Assigned</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="sr-only">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAssignments.map((assignment) => {
                const name = personName(assignment.userTenant);
                return (
                  <TableRow key={assignment.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8">
                          <AvatarFallback className="text-[11px] font-semibold">
                            {initials(name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate font-medium">{name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {assignment.userTenant.user.email}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="capitalize">
                      {assignment.role.replace('-', ' ')}
                    </TableCell>
                    <TableCell className="text-muted-foreground max-md:hidden">
                      {formatDate(assignment.assignedAt)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        tone={assignment.isActive ? 'success' : 'neutral'}
                        dot={assignment.isActive}
                      >
                        {assignment.isActive ? 'Active' : 'Ended'}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="text-right">
                      {canAssign && assignment.isActive ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Unassign ${name}`}
                          onClick={() => void unassignTeacher(assignment.userTenantId)}
                          disabled={!live || busy}
                        >
                          <UserMinus />
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </DataTableLayout>
      </div>
    </ShellMain>
  );
}
