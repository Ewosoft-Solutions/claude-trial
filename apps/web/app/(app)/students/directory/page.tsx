'use client';

/* ============================================================
   /students/directory — the student directory

   The first real collection surface, built from the shared M6
   DataTableLayout (toolbar + table + footer) wired to the M5
   states: a short mount-time load shows the SkeletonTable, and an
   over-filtered result shows the EmptyState (with a reset action),
   so the view never renders blank. Product copy + mock rows live
   here; the shared components stay data-driven.

   Replaces the `[...slug]` placeholder for this route. Real data
   (and server-side authorization) lands with the API in a later
   phase — `useViewer()` already supplies the tenant context.
   ============================================================ */

import * as React from 'react';
import { Download, Search, UserPlus } from 'lucide-react';

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
import { PageHeader } from '@workspace/ui/custom/shell/page-header';
import { ShellMain } from '@workspace/ui/custom/shell/app-shell';
import { DataTableLayout } from '@workspace/ui/custom/layouts/data-table-layout';
import { EmptyState } from '@workspace/ui/custom/states/page-states';
import { StatusBadge } from '@workspace/ui/custom/data-display/status-badge';
import type { StateTone } from '@workspace/ui/types/states.types';
import type { PageHeaderMeta } from '@workspace/ui/types/shell.types';

import { useViewer } from '@/app/providers/viewer-provider';

/* ---- mock data ----------------------------------------------- */

type Enrollment = 'active' | 'graduating' | 'suspended';
type FeeStatus = 'paid' | 'partial' | 'owing';

interface StudentRow {
  id: string;
  name: string;
  className: string;
  guardian: string;
  enrollment: Enrollment;
  fees: FeeStatus;
}

const STUDENTS: StudentRow[] = [
  { id: 'SJ-1042', name: 'Adaeze Okafor', className: 'JSS 1A', guardian: 'Mrs. N. Okafor', enrollment: 'active', fees: 'paid' },
  { id: 'SJ-1043', name: 'Tunde Bakare', className: 'JSS 1A', guardian: 'Mr. K. Bakare', enrollment: 'active', fees: 'owing' },
  { id: 'SJ-1071', name: 'Chiamaka Eze', className: 'JSS 2B', guardian: 'Dr. P. Eze', enrollment: 'active', fees: 'partial' },
  { id: 'SJ-1088', name: 'Ibrahim Sani', className: 'JSS 2B', guardian: 'Mrs. A. Sani', enrollment: 'suspended', fees: 'owing' },
  { id: 'SJ-1102', name: 'Fatima Bello', className: 'JSS 3A', guardian: 'Mr. Y. Bello', enrollment: 'active', fees: 'paid' },
  { id: 'SJ-1119', name: 'Emeka Nwosu', className: 'JSS 3A', guardian: 'Mrs. C. Nwosu', enrollment: 'active', fees: 'partial' },
  { id: 'SJ-1203', name: 'Zainab Yusuf', className: 'SSS 1A', guardian: 'Alhaji M. Yusuf', enrollment: 'active', fees: 'paid' },
  { id: 'SJ-1221', name: 'David Adeyemi', className: 'SSS 1A', guardian: 'Mr. S. Adeyemi', enrollment: 'active', fees: 'owing' },
  { id: 'SJ-1244', name: 'Grace Obi', className: 'SSS 2B', guardian: 'Mrs. L. Obi', enrollment: 'active', fees: 'paid' },
  { id: 'SJ-1290', name: 'Samuel Etim', className: 'SSS 3A', guardian: 'Mr. B. Etim', enrollment: 'graduating', fees: 'paid' },
  { id: 'SJ-1291', name: 'Halima Musa', className: 'SSS 3A', guardian: 'Mrs. R. Musa', enrollment: 'graduating', fees: 'partial' },
  { id: 'SJ-1305', name: 'Peace Udo', className: 'SSS 3A', guardian: 'Pastor J. Udo', enrollment: 'graduating', fees: 'owing' },
];

const CLASSES = ['JSS 1A', 'JSS 2B', 'JSS 3A', 'SSS 1A', 'SSS 2B', 'SSS 3A'];

const ENROLLMENT_META: Record<
  Enrollment,
  { label: string; tone: StateTone }
> = {
  active: { label: 'Active', tone: 'success' },
  graduating: { label: 'Graduating', tone: 'info' },
  suspended: { label: 'Suspended', tone: 'warning' },
};

const FEE_META: Record<FeeStatus, { label: string; tone: StateTone }> = {
  paid: { label: 'Paid', tone: 'success' },
  partial: { label: 'Part-paid', tone: 'info' },
  owing: { label: 'Owing', tone: 'destructive' },
};

const META: PageHeaderMeta[] = [
  { key: 'term', label: 'Spring Term 2025', emphasis: true },
  { key: 'active', label: '1,180 active' },
  { key: 'updated', label: 'synced 4m ago' },
];

/** Build initials for the avatar fallback. */
function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}

export default function StudentDirectoryPage() {
  const { schools, activeSchoolId } = useViewer();
  const schoolName =
    schools.find((s) => s.id === activeSchoolId)?.name ?? 'your school';

  // Brief mount-time load to exercise the SkeletonTable wiring; real
  // loading state arrives with the data layer.
  const [loading, setLoading] = React.useState(true);
  React.useEffect(() => {
    const t = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(t);
  }, []);

  const [query, setQuery] = React.useState('');
  const [classFilter, setClassFilter] = React.useState('all');
  const [statusFilter, setStatusFilter] = React.useState('all');

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return STUDENTS.filter((s) => {
      const matchesQuery =
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q) ||
        s.guardian.toLowerCase().includes(q);
      const matchesClass = classFilter === 'all' || s.className === classFilter;
      const matchesStatus =
        statusFilter === 'all' || s.enrollment === statusFilter;
      return matchesQuery && matchesClass && matchesStatus;
    });
  }, [query, classFilter, statusFilter]);

  const hasFilters =
    query.trim() !== '' || classFilter !== 'all' || statusFilter !== 'all';

  function resetFilters() {
    setQuery('');
    setClassFilter('all');
    setStatusFilter('all');
  }

  return (
    <ShellMain>
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Student directory"
          meta={META}
          actions={
            <>
              <Button variant="outline" size="sm" className="max-md:hidden">
                <Download /> Export
              </Button>
              <Button size="sm">
                <UserPlus /> Add student
              </Button>
            </>
          }
        />

        <DataTableLayout
          title="Students"
          description={
            loading
              ? `Loading ${schoolName}…`
              : `${filtered.length} of ${STUDENTS.length} students`
          }
          loading={loading}
          empty={!loading && filtered.length === 0}
          skeletonColumns={5}
          toolbar={
            <>
              <div className="relative w-full sm:w-56">
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
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search name, ID, guardian…"
                  className="pl-8"
                />
              </div>

              <Select value={classFilter} onValueChange={setClassFilter}>
                <SelectTrigger className="w-[7.5rem]" aria-label="Filter by class">
                  <SelectValue placeholder="Class" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All classes</SelectItem>
                  {CLASSES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[8.5rem]" aria-label="Filter by status">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="graduating">Graduating</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </>
          }
          emptyState={
            <EmptyState
              compact
              title="No students match your filters"
              description="Try a different search term, or clear the filters to see the full directory."
              primaryAction={{ label: 'Clear filters', onClick: resetFilters }}
            />
          }
          footer={
            <>
              <span>
                Showing <strong className="text-foreground">{filtered.length}</strong> of{' '}
                {STUDENTS.length}
              </span>
              {hasFilters ? (
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0"
                  onClick={resetFilters}
                >
                  Clear filters
                </Button>
              ) : null}
            </>
          }
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Class</TableHead>
                <TableHead className="max-md:hidden">Guardian</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Fees</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((s) => {
                const status = ENROLLMENT_META[s.enrollment];
                const fee = FEE_META[s.fees];
                return (
                  <TableRow key={s.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8">
                          <AvatarFallback className="text-[11px] font-semibold">
                            {initials(s.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate font-medium text-foreground">
                            {s.name}
                          </span>
                          <span className="truncate text-xs text-muted-foreground">
                            {s.id}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {s.className}
                    </TableCell>
                    <TableCell className="text-muted-foreground max-md:hidden">
                      {s.guardian}
                    </TableCell>
                    <TableCell>
                      <StatusBadge tone={status.tone} dot>
                        {status.label}
                      </StatusBadge>
                    </TableCell>
                    <TableCell>
                      <StatusBadge tone={fee.tone}>{fee.label}</StatusBadge>
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
