'use client';

/* ============================================================
   /students/gradebook/report-cards — term report cards

   Per-student term report-card status (average + grade + publish
   state). DataTableLayout (search + status filter, Skeleton/Empty).
   Mock rows + copy live here. Replaces the `[...slug]` placeholder.
   ============================================================ */

import * as React from 'react';
import { Search, Send } from 'lucide-react';

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

type Status = 'published' | 'ready' | 'draft';

interface ReportCard {
  id: string;
  name: string;
  className: string;
  average: number;
  status: Status;
}

const CARDS: ReportCard[] = [
  { id: 'SJ-1042', name: 'Adaeze Okafor', className: 'JSS 1A', average: 84, status: 'published' },
  { id: 'SJ-1043', name: 'Tunde Bakare', className: 'JSS 1A', average: 61, status: 'published' },
  { id: 'SJ-1071', name: 'Chiamaka Eze', className: 'JSS 2B', average: 76, status: 'ready' },
  { id: 'SJ-1088', name: 'Ibrahim Sani', className: 'JSS 2B', average: 48, status: 'ready' },
  { id: 'SJ-1102', name: 'Fatima Bello', className: 'JSS 3A', average: 92, status: 'published' },
  { id: 'SJ-1119', name: 'Emeka Nwosu', className: 'JSS 3A', average: 68, status: 'draft' },
  { id: 'SJ-1203', name: 'Zainab Yusuf', className: 'SSS 1A', average: 81, status: 'ready' },
  { id: 'SJ-1221', name: 'David Adeyemi', className: 'SSS 1A', average: 55, status: 'draft' },
];

const STATUS_META: Record<Status, { label: string; tone: StateTone }> = {
  published: { label: 'Published', tone: 'success' },
  ready: { label: 'Ready', tone: 'info' },
  draft: { label: 'Draft', tone: 'neutral' },
};

function grade(avg: number): { letter: string; tone: StateTone } {
  if (avg >= 70) return { letter: 'A', tone: 'success' };
  if (avg >= 60) return { letter: 'B', tone: 'success' };
  if (avg >= 50) return { letter: 'C', tone: 'info' };
  if (avg >= 40) return { letter: 'D', tone: 'warning' };
  return { letter: 'F', tone: 'destructive' };
}

const META: PageHeaderMeta[] = [
  { key: 'term', label: 'Spring Term 2025', emphasis: true },
  { key: 'cards', label: 'report cards' },
];

function initials(name: string): string {
  return name.split(' ').slice(0, 2).map((p) => p[0]).join('').toUpperCase();
}

export default function ReportCardsPage() {
  const [loading, setLoading] = React.useState(true);
  React.useEffect(() => {
    const t = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(t);
  }, []);

  const [query, setQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('all');

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return CARDS.filter((c) => {
      const matchesQuery =
        !q || c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [query, statusFilter]);

  const hasFilters = query.trim() !== '' || statusFilter !== 'all';
  function resetFilters() {
    setQuery('');
    setStatusFilter('all');
  }

  const readyCount = CARDS.filter((c) => c.status === 'ready').length;

  return (
    <ShellMain>
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Report cards"
          meta={META}
          actions={
            <Button size="sm" disabled={readyCount === 0}>
              <Send /> Publish ready ({readyCount})
            </Button>
          }
        />

        <DataTableLayout
          title="Term report cards"
          description={
            loading
              ? 'Loading report cards…'
              : `${filtered.length} of ${CARDS.length} students`
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
                <Label htmlFor="rc-search" className="sr-only">
                  Search students
                </Label>
                <Input
                  id="rc-search"
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search name or ID…"
                  className="pl-8"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[8.5rem]" aria-label="Filter by status">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="ready">Ready</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                </SelectContent>
              </Select>
            </>
          }
          emptyState={
            <EmptyState
              compact
              title="No report cards match your filters"
              description="Try a different search term, or clear the filters."
              primaryAction={{ label: 'Clear filters', onClick: resetFilters }}
            />
          }
          footer={
            <>
              <span>
                Showing <strong className="text-foreground">{filtered.length}</strong> of{' '}
                {CARDS.length}
              </span>
              {hasFilters ? (
                <Button variant="link" size="sm" className="h-auto p-0" onClick={resetFilters}>
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
                <TableHead className="max-md:hidden">Class</TableHead>
                <TableHead className="text-right">Term avg</TableHead>
                <TableHead className="text-right">Grade</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => {
                const status = STATUS_META[c.status];
                const g = grade(c.average);
                return (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8">
                          <AvatarFallback className="text-[11px] font-semibold">
                            {initials(c.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate font-medium text-foreground">{c.name}</span>
                          <span className="truncate text-xs text-muted-foreground">{c.id}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground max-md:hidden">{c.className}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums text-foreground">
                      {c.average}%
                    </TableCell>
                    <TableCell className="text-right">
                      <StatusBadge tone={g.tone}>{g.letter}</StatusBadge>
                    </TableCell>
                    <TableCell>
                      <StatusBadge tone={status.tone} dot={c.status !== 'draft'}>
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
