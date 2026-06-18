'use client';

/* ============================================================
   /classes/subjects — the subject catalog

   The directory recipe applied to subjects: DataTableLayout
   (search + level filter) + the M5 states (SkeletonTable on load,
   EmptyState + reset when over-filtered). Status reads as a
   StatusBadge. Mock rows + copy live here. Replaces the `[...slug]`
   placeholder.
   ============================================================ */

import * as React from 'react';
import { Plus, Search } from 'lucide-react';

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

type Level = 'junior' | 'senior';
type Status = 'active' | 'elective' | 'archived';

interface Subject {
  code: string;
  name: string;
  teacher: string;
  classes: number;
  periods: number;
  level: Level;
  status: Status;
}

const SUBJECTS: Subject[] = [
  { code: 'MTH', name: 'Mathematics', teacher: 'Mr. O. Bello', classes: 6, periods: 5, level: 'junior', status: 'active' },
  { code: 'ENG', name: 'English Language', teacher: 'Mrs. A. Cole', classes: 6, periods: 5, level: 'junior', status: 'active' },
  { code: 'BSC', name: 'Basic Science', teacher: 'Dr. P. Eze', classes: 4, periods: 4, level: 'junior', status: 'active' },
  { code: 'SOS', name: 'Social Studies', teacher: 'Mr. K. Udo', classes: 4, periods: 3, level: 'junior', status: 'active' },
  { code: 'PHY', name: 'Physics', teacher: 'Mrs. R. Musa', classes: 3, periods: 4, level: 'senior', status: 'active' },
  { code: 'CHM', name: 'Chemistry', teacher: 'Mr. S. Etim', classes: 3, periods: 4, level: 'senior', status: 'active' },
  { code: 'BIO', name: 'Biology', teacher: 'Mrs. C. Nwosu', classes: 3, periods: 4, level: 'senior', status: 'active' },
  { code: 'FRN', name: 'French', teacher: 'Mme. L. Diallo', classes: 5, periods: 2, level: 'junior', status: 'elective' },
  { code: 'MUS', name: 'Music', teacher: 'Mr. B. Okoro', classes: 2, periods: 2, level: 'junior', status: 'elective' },
  { code: 'LAT', name: 'Latin', teacher: '—', classes: 0, periods: 0, level: 'senior', status: 'archived' },
];

const STATUS_META: Record<Status, { label: string; tone: StateTone }> = {
  active: { label: 'Active', tone: 'success' },
  elective: { label: 'Elective', tone: 'info' },
  archived: { label: 'Archived', tone: 'neutral' },
};

const META: PageHeaderMeta[] = [
  { key: 'term', label: 'Spring Term 2025', emphasis: true },
  { key: 'count', label: '9 active subjects' },
];

export default function SubjectsPage() {
  const [loading, setLoading] = React.useState(true);
  React.useEffect(() => {
    const t = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(t);
  }, []);

  const [query, setQuery] = React.useState('');
  const [levelFilter, setLevelFilter] = React.useState('all');

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return SUBJECTS.filter((s) => {
      const matchesQuery =
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q) ||
        s.teacher.toLowerCase().includes(q);
      const matchesLevel = levelFilter === 'all' || s.level === levelFilter;
      return matchesQuery && matchesLevel;
    });
  }, [query, levelFilter]);

  const hasFilters = query.trim() !== '' || levelFilter !== 'all';

  function resetFilters() {
    setQuery('');
    setLevelFilter('all');
  }

  return (
    <ShellMain>
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Subjects"
          meta={META}
          actions={
            <Button size="sm">
              <Plus /> Add subject
            </Button>
          }
        />

        <DataTableLayout
          title="Subject catalog"
          description={
            loading
              ? 'Loading subjects…'
              : `${filtered.length} of ${SUBJECTS.length} subjects`
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
                <Label htmlFor="subject-search" className="sr-only">
                  Search subjects
                </Label>
                <Input
                  id="subject-search"
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search subject, code, teacher…"
                  className="pl-8"
                />
              </div>

              <Select value={levelFilter} onValueChange={setLevelFilter}>
                <SelectTrigger className="w-[8rem]" aria-label="Filter by level">
                  <SelectValue placeholder="Level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All levels</SelectItem>
                  <SelectItem value="junior">Junior</SelectItem>
                  <SelectItem value="senior">Senior</SelectItem>
                </SelectContent>
              </Select>
            </>
          }
          emptyState={
            <EmptyState
              compact
              title="No subjects match your filters"
              description="Try a different search term, or clear the filters to see the full catalog."
              primaryAction={{ label: 'Clear filters', onClick: resetFilters }}
            />
          }
          footer={
            <>
              <span>
                Showing <strong className="text-foreground">{filtered.length}</strong> of{' '}
                {SUBJECTS.length}
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
                <TableHead>Subject</TableHead>
                <TableHead className="max-md:hidden">Teacher</TableHead>
                <TableHead className="text-right">Classes</TableHead>
                <TableHead className="text-right max-sm:hidden">Periods/wk</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((s) => {
                const status = STATUS_META[s.status];
                return (
                  <TableRow key={s.code}>
                    <TableCell>
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate font-medium text-foreground">
                          {s.name}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {s.code}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground max-md:hidden">
                      {s.teacher}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {s.classes}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground max-sm:hidden">
                      {s.periods}
                    </TableCell>
                    <TableCell>
                      <StatusBadge tone={status.tone} dot={s.status === 'active'}>
                        {status.label}
                      </StatusBadge>
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
