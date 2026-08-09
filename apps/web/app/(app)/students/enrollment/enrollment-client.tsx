'use client';

/* ============================================================
   EnrollmentClient — admissions pipeline (client-side DirectoryTable)

   Receives the full applicant list, so search / stage + decision filters /
   sort / paging run in-memory. Both filters collapse into the Pattern-B
   Filters button. StatGrid shows the pipeline summary.
   ============================================================ */

import * as React from 'react';
import { Download, UserPlus } from 'lucide-react';

import { Avatar, AvatarFallback } from '@workspace/ui/components/avatar';
import { Button } from '@workspace/ui/components/button';
import { PageHeader } from '@workspace/ui/custom/shell/page-header';
import { ShellMain } from '@workspace/ui/custom/shell/app-shell';
import { StatGrid } from '@workspace/ui/custom/layouts/stat-grid';
import { EmptyState } from '@workspace/ui/custom/states/page-states';
import { StatusBadge } from '@workspace/ui/custom/data-display/status-badge';
import {
  DirectoryTable,
  type DirectoryColumn,
} from '@workspace/ui/custom/tables/directory-table';
import type { StateTone } from '@workspace/ui/types/states.types';
import type { StatItem } from '@workspace/ui/types/layout.types';
import type { PageHeaderMeta } from '@workspace/ui/types/shell.types';
import type { DirectorySort } from '@workspace/ui/lib/directory-state';

import { DEFAULT_PAGE_SIZE } from '@/lib/page-size';

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
  const [term, setTerm] = React.useState('');
  const [filters, setFilters] = React.useState<
    Record<string, string | null | undefined>
  >({});
  const [sort, setSort] = React.useState<DirectorySort | null>(null);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(DEFAULT_PAGE_SIZE);

  React.useEffect(() => setPage(1), [term, filters, pageSize]);

  const columns: DirectoryColumn<Applicant>[] = [
    {
      id: 'name',
      header: 'Applicant',
      sortable: true,
      cell: (a) => (
        <div className="flex items-center gap-3">
          <Avatar className="size-8">
            <AvatarFallback
              seed={a.name}
              className="text-[calc(11px*var(--font-scale))] font-semibold"
            >
              {initials(a.name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-col">
            <span className="break-words font-medium text-foreground">
              {a.name}
            </span>
            <span className="break-words text-xs text-muted-foreground">
              {a.id}
            </span>
          </div>
        </div>
      ),
    },
    {
      id: 'applyingFor',
      header: 'Applying for',
      hideable: true,
      cell: (a) => (
        <span className="text-muted-foreground">{a.applyingFor}</span>
      ),
    },
    {
      id: 'submitted',
      header: 'Submitted',
      sortable: true,
      hideable: true,
      cell: (a) => <span className="text-muted-foreground">{a.submitted}</span>,
    },
    {
      id: 'stage',
      header: 'Stage',
      sortable: true,
      cell: (a) => {
        const stage = STAGE_META[a.stage];
        return <StatusBadge tone={stage.tone}>{stage.label}</StatusBadge>;
      },
    },
    {
      id: 'decision',
      header: 'Decision',
      sortable: true,
      cell: (a) => {
        const decision = DECISION_META[a.decision];
        return (
          <StatusBadge tone={decision.tone} dot>
            {decision.label}
          </StatusBadge>
        );
      },
    },
  ];

  const filtered = React.useMemo(() => {
    const q = term.trim().toLowerCase();
    const stage = filters.stage;
    const decision = filters.decision;
    let out = applicants.filter((a) => {
      const matchesQ =
        !q ||
        a.name.toLowerCase().includes(q) ||
        a.id.toLowerCase().includes(q) ||
        a.guardian.toLowerCase().includes(q);
      const matchesStage = !stage || a.stage === stage;
      const matchesDecision = !decision || a.decision === decision;
      return matchesQ && matchesStage && matchesDecision;
    });
    if (sort) {
      const dir = sort.dir === 'desc' ? -1 : 1;
      out = [...out].sort((a, b) =>
        sort.field === 'submitted'
          ? dir * a.submitted.localeCompare(b.submitted)
          : sort.field === 'stage'
            ? dir * a.stage.localeCompare(b.stage)
            : sort.field === 'decision'
              ? dir * a.decision.localeCompare(b.decision)
              : dir * a.name.localeCompare(b.name),
      );
    }
    return out;
  }, [applicants, term, filters, sort]);

  const stats: StatItem[] = React.useMemo(() => {
    const count = (fn: (a: Applicant) => boolean) =>
      applicants.filter(fn).length;
    return [
      { key: 'total', label: 'Applications', value: String(applicants.length) },
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
  }, [applicants]);

  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const hasQuery = term.trim() !== '' || Object.values(filters).some(Boolean);

  return (
    <ShellMain>
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Admissions"
          meta={META}
          actions={
            <>
              <Button variant="outline" size="sm">
                <Download /> Export
              </Button>
              <Button size="sm">
                <UserPlus /> New application
              </Button>
            </>
          }
        />

        <StatGrid items={stats} />

        <DirectoryTable<Applicant>
          title="Applications"
          description={`${filtered.length} of ${applicants.length} applications`}
          columns={columns}
          rows={pageRows}
          getRowId={(a) => a.id}
          getRowLabel={(a) => a.name}
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
          caption="Admissions pipeline"
          search={{
            value: term,
            onChange: setTerm,
            placeholder: 'Search applicant, ID, guardian…',
            label: 'Search applicants',
            id: 'applicant-search',
          }}
          filters={[
            {
              key: 'stage',
              label: 'Stage',
              options: STAGES.map((s) => ({ value: s.value, label: s.label })),
            },
            {
              key: 'decision',
              label: 'Decision',
              options: (Object.keys(DECISION_META) as Decision[]).map((k) => ({
                value: k,
                label: DECISION_META[k].label,
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
              title={
                hasQuery
                  ? 'No applications match your filters'
                  : 'No applications yet'
              }
              description={
                hasQuery
                  ? 'Try a different search term, or clear the filters to see the full pipeline.'
                  : 'Run the dev operational seed or create an admission application.'
              }
            />
          }
        />
      </div>
    </ShellMain>
  );
}
