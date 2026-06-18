'use client';

/* ============================================================
   /students/gradebook/transcripts — cumulative transcripts

   Per-student cumulative record (CGPA + standing + completeness).
   DataTableLayout (search + standing filter, Skeleton/Empty). Mock
   rows + copy live here. Replaces the `[...slug]` placeholder.
   ============================================================ */

import * as React from 'react';
import { Download, Search } from 'lucide-react';

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

type Standing = 'honors' | 'good' | 'probation';

interface Transcript {
  id: string;
  name: string;
  className: string;
  cgpa: number;
  credits: number;
  standing: Standing;
  complete: boolean;
}

const TRANSCRIPTS: Transcript[] = [
  { id: 'SJ-1203', name: 'Zainab Yusuf', className: 'SSS 1A', cgpa: 3.8, credits: 96, standing: 'honors', complete: true },
  { id: 'SJ-1221', name: 'David Adeyemi', className: 'SSS 1A', cgpa: 2.4, credits: 92, standing: 'probation', complete: true },
  { id: 'SJ-1244', name: 'Grace Obi', className: 'SSS 2B', cgpa: 3.2, credits: 88, standing: 'good', complete: true },
  { id: 'SJ-1290', name: 'Samuel Etim', className: 'SSS 3A', cgpa: 3.9, credits: 120, standing: 'honors', complete: true },
  { id: 'SJ-1291', name: 'Halima Musa', className: 'SSS 3A', cgpa: 3.4, credits: 120, standing: 'good', complete: true },
  { id: 'SJ-1305', name: 'Peace Udo', className: 'SSS 3A', cgpa: 2.1, credits: 114, standing: 'probation', complete: false },
];

const STANDING_META: Record<Standing, { label: string; tone: StateTone }> = {
  honors: { label: 'Honors', tone: 'success' },
  good: { label: 'Good standing', tone: 'info' },
  probation: { label: 'Probation', tone: 'warning' },
};

const META: PageHeaderMeta[] = [
  { key: 'year', label: '2024 / 2025', emphasis: true },
  { key: 'scope', label: 'senior school' },
];

function initials(name: string): string {
  return name.split(' ').slice(0, 2).map((p) => p[0]).join('').toUpperCase();
}

export default function TranscriptsPage() {
  const [loading, setLoading] = React.useState(true);
  React.useEffect(() => {
    const t = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(t);
  }, []);

  const [query, setQuery] = React.useState('');
  const [standingFilter, setStandingFilter] = React.useState('all');

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return TRANSCRIPTS.filter((t) => {
      const matchesQuery =
        !q || t.name.toLowerCase().includes(q) || t.id.toLowerCase().includes(q);
      const matchesStanding =
        standingFilter === 'all' || t.standing === standingFilter;
      return matchesQuery && matchesStanding;
    });
  }, [query, standingFilter]);

  const hasFilters = query.trim() !== '' || standingFilter !== 'all';
  function resetFilters() {
    setQuery('');
    setStandingFilter('all');
  }

  return (
    <ShellMain>
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Transcripts"
          meta={META}
          actions={
            <Button variant="outline" size="sm">
              <Download /> Export
            </Button>
          }
        />

        <DataTableLayout
          title="Cumulative transcripts"
          description={
            loading
              ? 'Loading transcripts…'
              : `${filtered.length} of ${TRANSCRIPTS.length} students`
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
                <Label htmlFor="tr-search" className="sr-only">
                  Search students
                </Label>
                <Input
                  id="tr-search"
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search name or ID…"
                  className="pl-8"
                />
              </div>
              <Select value={standingFilter} onValueChange={setStandingFilter}>
                <SelectTrigger className="w-[10rem]" aria-label="Filter by standing">
                  <SelectValue placeholder="Standing" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All standings</SelectItem>
                  <SelectItem value="honors">Honors</SelectItem>
                  <SelectItem value="good">Good standing</SelectItem>
                  <SelectItem value="probation">Probation</SelectItem>
                </SelectContent>
              </Select>
            </>
          }
          emptyState={
            <EmptyState
              compact
              title="No transcripts match your filters"
              description="Try a different search term, or clear the filters."
              primaryAction={{ label: 'Clear filters', onClick: resetFilters }}
            />
          }
          footer={
            <>
              <span>
                Showing <strong className="text-foreground">{filtered.length}</strong> of{' '}
                {TRANSCRIPTS.length}
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
                <TableHead className="text-right">CGPA</TableHead>
                <TableHead className="text-right max-sm:hidden">Credits</TableHead>
                <TableHead>Standing</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((t) => {
                const standing = STANDING_META[t.standing];
                return (
                  <TableRow key={t.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8">
                          <AvatarFallback className="text-[11px] font-semibold">
                            {initials(t.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate font-medium text-foreground">
                            {t.name}
                            {!t.complete ? (
                              <span className="ml-2 text-xs font-normal text-muted-foreground">
                                (incomplete)
                              </span>
                            ) : null}
                          </span>
                          <span className="truncate text-xs text-muted-foreground">{t.id}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground max-md:hidden">{t.className}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums text-foreground">
                      {t.cgpa.toFixed(1)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground max-sm:hidden">
                      {t.credits}
                    </TableCell>
                    <TableCell>
                      <StatusBadge tone={standing.tone} dot>
                        {standing.label}
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
