'use client';

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

export type Enrollment =
  | 'active'
  | 'inactive'
  | 'suspended'
  | 'graduated'
  | 'transferred'
  | 'withdrawn';
export type FeeStatus = 'paid' | 'partial' | 'owing' | 'none';

export interface StudentRow {
  id: string;
  name: string;
  className: string;
  guardian: string;
  enrollment: Enrollment;
  fees: FeeStatus;
}

const ENROLLMENT_META: Record<Enrollment, { label: string; tone: StateTone }> =
  {
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

function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}

interface Props {
  students: StudentRow[];
  schoolName: string;
  meta: PageHeaderMeta[];
  initialQuery?: string;
}

export function StudentDirectoryClient({
  students,
  schoolName,
  meta,
  initialQuery = '',
}: Props) {
  const [query, setQuery] = React.useState(initialQuery);
  const [classFilter, setClassFilter] = React.useState('all');
  const [statusFilter, setStatusFilter] = React.useState('all');

  const classes = React.useMemo(
    () =>
      Array.from(
        new Set(
          students
            .map((student) => student.className)
            .filter((name) => name !== '-'),
        ),
      ).sort(),
    [students],
  );

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return students.filter((student) => {
      const matchesQuery =
        !q ||
        student.name.toLowerCase().includes(q) ||
        student.id.toLowerCase().includes(q) ||
        student.guardian.toLowerCase().includes(q);
      const matchesClass =
        classFilter === 'all' || student.className === classFilter;
      const matchesStatus =
        statusFilter === 'all' || student.enrollment === statusFilter;
      return matchesQuery && matchesClass && matchesStatus;
    });
  }, [students, query, classFilter, statusFilter]);

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
          meta={meta}
          actions={
            <>
              <Button variant="outline" size="sm">
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
          description={`${filtered.length} of ${students.length} students in ${schoolName}`}
          loading={false}
          empty={filtered.length === 0}
          skeletonColumns={5}
          toolbar={
            <>
              <div className="relative flex-1 min-w-0 @md/main:w-56 @md/main:flex-none">
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
                  placeholder="Search name, ID, guardian..."
                  className="pl-8"
                />
              </div>

              <Select value={classFilter} onValueChange={setClassFilter}>
                <SelectTrigger
                  className="w-[7.5rem]"
                  aria-label="Filter by class"
                >
                  <SelectValue placeholder="Class" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All classes</SelectItem>
                  {classes.map((className) => (
                    <SelectItem key={className} value={className}>
                      {className}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger
                  className="w-[8.5rem]"
                  aria-label="Filter by status"
                >
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="graduated">Graduated</SelectItem>
                  <SelectItem value="transferred">Transferred</SelectItem>
                  <SelectItem value="withdrawn">Withdrawn</SelectItem>
                </SelectContent>
              </Select>
            </>
          }
          emptyState={
            <EmptyState
              compact
              title={
                hasFilters
                  ? 'No students match your filters'
                  : 'No students yet'
              }
              description={
                hasFilters
                  ? 'Try a different search term, or clear the filters to see the full directory.'
                  : 'Run the dev academic seed or create a student record.'
              }
              primaryAction={
                hasFilters
                  ? { label: 'Clear filters', onClick: resetFilters }
                  : undefined
              }
            />
          }
          footer={
            <>
              <span>
                Showing{' '}
                <strong className="text-foreground">{filtered.length}</strong>{' '}
                of {students.length}
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
                <TableHead>Guardian</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Fees</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((student) => {
                const status = ENROLLMENT_META[student.enrollment];
                const fee = FEE_META[student.fees];
                return (
                  <TableRow key={student.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8">
                          <AvatarFallback className="text-[11px] font-semibold">
                            {initials(student.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex min-w-0 flex-col">
                          <span className="break-words font-medium text-foreground">
                            {student.name}
                          </span>
                          <span className="break-words text-xs text-muted-foreground">
                            {student.id}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {student.className}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {student.guardian}
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
