'use client';

/* ============================================================
   EnrollmentClient — admissions pipeline interactive table

   Receives server-fetched applicants as props (or falls back to
   built-in mock data when no API is configured). Built from the
   same recipe as the directory: M6 StatGrid (pipeline summary) +
   DataTableLayout (toolbar + table + footer) wired to the M5
   states (SkeletonTable on a brief mount-time load, EmptyState
   with a reset when over-filtered). Stage + decision read as
   StatusBadges.
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
import { StatGrid } from '@workspace/ui/custom/layouts/stat-grid';
import { EmptyState } from '@workspace/ui/custom/states/page-states';
import { StatusBadge } from '@workspace/ui/custom/data-display/status-badge';
import type { StateTone } from '@workspace/ui/types/states.types';
import type { StatItem } from '@workspace/ui/types/layout.types';
import type { PageHeaderMeta } from '@workspace/ui/types/shell.types';

export type Stage = 'application' | 'interview' | 'decision';
export type Decision = 'pending' | 'accepted' | 'waitlisted' | 'rejected';

export interface Applicant {
  id: string;
  name: string;
  applyingFor: string;
  submitted: string;
  guardian: string;
  stage: Stage;
  decision: Decision;
}

const MOCK_APPLICANTS: Applicant[] = [
  { id: 'AP-2051', name: 'Ngozi Achebe', applyingFor: 'JSS 1', submitted: '12 Mar', guardian: 'Mrs. E. Achebe', stage: 'decision', decision: 'accepted' },
  { id: 'AP-2052', name: 'Bola Adewale', applyingFor: 'JSS 1', submitted: '12 Mar', guardian: 'Mr. T. Adewale', stage: 'interview', decision: 'pending' },
  { id: 'AP-2058', name: 'Kelechi Obi', applyingFor: 'JSS 1', submitted: '13 Mar', guardian: 'Dr. U. Obi', stage: 'application', decision: 'pending' },
  { id: 'AP-2061', name: 'Aisha Lawal', applyingFor: 'SSS 1', submitted: '14 Mar', guardian: 'Alhaja R. Lawal', stage: 'decision', decision: 'waitlisted' },
  { id: 'AP-2064', name: 'Daniel Okon', applyingFor: 'SSS 1', submitted: '15 Mar', guardian: 'Mr. G. Okon', stage: 'decision', decision: 'accepted' },
  { id: 'AP-2070', name: 'Mary Johnson', applyingFor: 'JSS 1', submitted: '16 Mar', guardian: 'Mrs. F. Johnson', stage: 'interview', decision: 'pending' },
  { id: 'AP-2073', name: 'Yusuf Garba', applyingFor: 'JSS 2', submitted: '17 Mar', guardian: 'Mr. I. Garba', stage: 'decision', decision: 'rejected' },
  { id: 'AP-2080', name: 'Esther Bassey', applyingFor: 'SSS 1', submitted: '18 Mar', guardian: 'Mrs. V. Bassey', stage: 'application', decision: 'pending' },
  { id: 'AP-2085', name: 'Tobi Williams', applyingFor: 'JSS 1', submitted: '18 Mar', guardian: 'Mr. A. Williams', stage: 'interview', decision: 'pending' },
  { id: 'AP-2090', name: 'Hauwa Abdullahi', applyingFor: 'SSS 2', submitted: '19 Mar', guardian: 'Mr. S. Abdullahi', stage: 'decision', decision: 'accepted' },
  { id: 'AP-2093', name: 'Chinedu Nnamdi', applyingFor: 'JSS 1', submitted: '20 Mar', guardian: 'Mrs. O. Nnamdi', stage: 'decision', decision: 'waitlisted' },
  { id: 'AP-2097', name: 'Blessing Eze', applyingFor: 'JSS 2', submitted: '21 Mar', guardian: 'Pastor C. Eze', stage: 'application', decision: 'pending' },
];

const STAGE_META: Record<Stage, { label: string; tone: StateTone }> = {
  application: { label: 'Application', tone: 'neutral' },
  interview: { label: 'Interview', tone: 'info' },
  decision: { label: 'Decision', tone: 'info' },
};

const DECISION_META: Record<Decision, { label: string; tone: StateTone }> = {
  pending: { label: 'Pending', tone: 'warning' },
  accepted: { label: 'Accepted', tone: 'success' },
  waitlisted: { label: 'Waitlisted', tone: 'info' },
  rejected: { label: 'Rejected', tone: 'destructive' },
};

const STAGES: { value: Stage; label: string }[] = [
  { value: 'application', label: 'Application' },
  { value: 'interview', label: 'Interview' },
  { value: 'decision', label: 'Decision' },
];

const META: PageHeaderMeta[] = [
  { key: 'intake', label: 'Spring 2025 intake', emphasis: true },
  { key: 'capacity', label: '34 seats open' },
  { key: 'closes', label: 'applications close 31 Mar' },
];

function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}

interface Props {
  applicants: Applicant[];
}

export function EnrollmentClient({ applicants }: Props) {
  const APPLICANTS = applicants.length > 0 ? applicants : MOCK_APPLICANTS;

  const [loading, setLoading] = React.useState(true);
  React.useEffect(() => {
    const t = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(t);
  }, []);

  const [query, setQuery] = React.useState('');
  const [stageFilter, setStageFilter] = React.useState('all');
  const [decisionFilter, setDecisionFilter] = React.useState('all');

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return APPLICANTS.filter((a) => {
      const matchesQuery =
        !q ||
        a.name.toLowerCase().includes(q) ||
        a.id.toLowerCase().includes(q) ||
        a.guardian.toLowerCase().includes(q);
      const matchesStage = stageFilter === 'all' || a.stage === stageFilter;
      const matchesDecision =
        decisionFilter === 'all' || a.decision === decisionFilter;
      return matchesQuery && matchesStage && matchesDecision;
    });
  }, [APPLICANTS, query, stageFilter, decisionFilter]);

  const hasFilters =
    query.trim() !== '' || stageFilter !== 'all' || decisionFilter !== 'all';

  function resetFilters() {
    setQuery('');
    setStageFilter('all');
    setDecisionFilter('all');
  }

  // Pipeline summary — derived live from the data.
  const stats: StatItem[] = React.useMemo(() => {
    const count = (fn: (a: Applicant) => boolean) => APPLICANTS.filter(fn).length;
    return [
      { key: 'total', label: 'Applications', value: String(APPLICANTS.length) },
      {
        key: 'review',
        label: 'In review',
        value: String(count((a) => a.decision === 'pending')),
      },
      {
        key: 'accepted',
        label: 'Accepted',
        value: String(count((a) => a.decision === 'accepted')),
      },
      {
        key: 'waitlisted',
        label: 'Waitlisted',
        value: String(count((a) => a.decision === 'waitlisted')),
      },
    ];
  }, [APPLICANTS]);

  return (
    <ShellMain>
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Admissions"
          meta={META}
          actions={
            <>
              <Button variant="outline" size="sm" className="max-md:hidden">
                <Download /> Export
              </Button>
              <Button size="sm">
                <UserPlus /> New application
              </Button>
            </>
          }
        />

        <StatGrid items={stats} />

        <DataTableLayout
          title="Applications"
          description={
            loading
              ? 'Loading applications…'
              : `${filtered.length} of ${APPLICANTS.length} applications`
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
                <Label htmlFor="applicant-search" className="sr-only">
                  Search applicants
                </Label>
                <Input
                  id="applicant-search"
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search applicant, ID, guardian…"
                  className="pl-8"
                />
              </div>

              <Select value={stageFilter} onValueChange={setStageFilter}>
                <SelectTrigger className="w-[8.5rem]" aria-label="Filter by stage">
                  <SelectValue placeholder="Stage" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All stages</SelectItem>
                  {STAGES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={decisionFilter} onValueChange={setDecisionFilter}>
                <SelectTrigger className="w-[9rem]" aria-label="Filter by decision">
                  <SelectValue placeholder="Decision" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All decisions</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="accepted">Accepted</SelectItem>
                  <SelectItem value="waitlisted">Waitlisted</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </>
          }
          emptyState={
            <EmptyState
              compact
              title="No applications match your filters"
              description="Try a different search term, or clear the filters to see the full pipeline."
              primaryAction={{ label: 'Clear filters', onClick: resetFilters }}
            />
          }
          footer={
            <>
              <span>
                Showing <strong className="text-foreground">{filtered.length}</strong> of{' '}
                {APPLICANTS.length}
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
                <TableHead>Applicant</TableHead>
                <TableHead>Applying for</TableHead>
                <TableHead className="max-md:hidden">Submitted</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Decision</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((a) => {
                const stage = STAGE_META[a.stage];
                const decision = DECISION_META[a.decision];
                return (
                  <TableRow key={a.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8">
                          <AvatarFallback className="text-[11px] font-semibold">
                            {initials(a.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate font-medium text-foreground">
                            {a.name}
                          </span>
                          <span className="truncate text-xs text-muted-foreground">
                            {a.id}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {a.applyingFor}
                    </TableCell>
                    <TableCell className="text-muted-foreground max-md:hidden">
                      {a.submitted}
                    </TableCell>
                    <TableCell>
                      <StatusBadge tone={stage.tone}>{stage.label}</StatusBadge>
                    </TableCell>
                    <TableCell>
                      <StatusBadge tone={decision.tone} dot>
                        {decision.label}
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
