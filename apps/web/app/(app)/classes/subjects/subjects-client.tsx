'use client';

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

export type SubjectLevel = 'junior' | 'senior' | 'all';
export type SubjectStatus = 'active' | 'draft' | 'archived';

export interface Subject {
  id: string;
  code: string;
  name: string;
  category: string;
  classes: number;
  periods: number;
  level: SubjectLevel;
  status: SubjectStatus;
}

interface Props {
  subjects: Subject[];
}

const STATUS_META: Record<SubjectStatus, { label: string; tone: StateTone }> = {
  active: { label: 'Active', tone: 'success' },
  draft: { label: 'Draft', tone: 'warning' },
  archived: { label: 'Archived', tone: 'neutral' },
};

function levelMatches(subject: Subject, level: string): boolean {
  return level === 'all' || subject.level === level || subject.level === 'all';
}

export function SubjectsClient({ subjects }: Props) {
  const [query, setQuery] = React.useState('');
  const [levelFilter, setLevelFilter] = React.useState('all');

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return subjects.filter((subject) => {
      const matchesQuery =
        !q ||
        subject.name.toLowerCase().includes(q) ||
        subject.code.toLowerCase().includes(q) ||
        subject.category.toLowerCase().includes(q);
      return matchesQuery && levelMatches(subject, levelFilter);
    });
  }, [query, levelFilter, subjects]);

  const hasFilters = query.trim() !== '' || levelFilter !== 'all';
  const meta: PageHeaderMeta[] = [
    { key: 'source', label: 'live courses', emphasis: true },
    { key: 'count', label: `${subjects.filter((subject) => subject.status === 'active').length} active subjects` },
  ];

  function resetFilters() {
    setQuery('');
    setLevelFilter('all');
  }

  return (
    <ShellMain>
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Subjects"
          meta={meta}
          actions={
            <Button size="sm">
              <Plus /> Add subject
            </Button>
          }
        />

        <DataTableLayout
          title="Subject catalog"
          description={`${filtered.length} of ${subjects.length} subjects`}
          empty={filtered.length === 0}
          skeletonColumns={5}
          toolbar={
            <>
              <div className="relative flex-1 min-w-0 @md/main:w-56 @md/main:flex-none">
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
                  placeholder="Search subject, code, category"
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
              title={hasFilters ? 'No subjects match your filters' : 'No subjects yet'}
              description={
                hasFilters
                  ? 'Try a different search term, or clear the filters to see the full catalog.'
                  : 'Create courses for this tenant and they will appear in the catalog.'
              }
              primaryAction={
                hasFilters ? { label: 'Clear filters', onClick: resetFilters } : undefined
              }
            />
          }
          footer={
            <>
              <span>
                Showing <strong className="text-foreground">{filtered.length}</strong> of{' '}
                {subjects.length}
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
                <TableHead className="max-md:hidden">Category</TableHead>
                <TableHead className="text-right">Classes</TableHead>
                <TableHead className="text-right max-sm:hidden">Periods/wk</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((subject) => {
                const status = STATUS_META[subject.status];
                return (
                  <TableRow key={subject.id}>
                    <TableCell>
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate font-medium text-foreground">
                          {subject.name}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {subject.code}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground max-md:hidden">
                      {subject.category}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {subject.classes}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground max-sm:hidden">
                      {subject.periods}
                    </TableCell>
                    <TableCell>
                      <StatusBadge tone={status.tone} dot={subject.status === 'active'}>
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
