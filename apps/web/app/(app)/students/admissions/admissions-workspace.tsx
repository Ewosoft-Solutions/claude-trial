'use client';

/**
 * WB3 · Admissions workspace (list) — on the governed design system.
 *
 * StatGrid pipeline summary + the governed DirectoryTable (Pattern-B search +
 * stage/decision filters + column hiding + a decision column), row-click opens
 * an at-a-glance drawer, "New application" opens the structured cascade form in
 * a side sheet, and the form builder link (criteria) sits in the header. The
 * full detail/edit lives at /students/admissions/[id].
 */
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FileText, Plus } from 'lucide-react';

import { Avatar, AvatarFallback } from '@workspace/ui/components/avatar';
import { Button } from '@workspace/ui/components/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@workspace/ui/components/sheet';
import { PageHeader } from '@workspace/ui/custom/shell/page-header';
import { ShellMain } from '@workspace/ui/custom/shell/app-shell';
import { StatGrid } from '@workspace/ui/custom/layouts/stat-grid';
import { EmptyState } from '@workspace/ui/custom/states/page-states';
import {
  DirectoryTable,
  type DirectoryColumn,
} from '@workspace/ui/custom/tables/directory-table';
import type { StatItem } from '@workspace/ui/types/layout.types';
import type { DirectorySort } from '@workspace/ui/lib/directory-state';

import { DEFAULT_PAGE_SIZE } from '@/lib/page-size';
import { formatCount } from '@/lib/format';
import {
  StageBadge,
  DecisionBadge,
  STAGE_LABEL,
  DECISION_LABEL,
  titleCase,
} from '@/lib/admissions/status';

import { NewApplicationForm } from './new-application-form';
import { ApplicationDrawer } from './application-drawer';
import {
  fmtDate,
  type Application,
  type IntakeStructure,
  type Perms,
} from './admissions-types';

// The WB3 stage machine + decision values, as filter options (ordered).
const STAGE_OPTIONS = [
  'enquiry',
  'applied',
  'screening',
  'interview',
  'offer',
  'accepted',
  'enrolled',
  'rejected',
  'withdrawn',
] as const;
const DECISION_OPTIONS = [
  'pending',
  'accepted',
  'waitlisted',
  'rejected',
] as const;

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0] ?? '')
    .join('')
    .toUpperCase();
}

export function AdmissionsWorkspace({
  perms,
  applications,
  structure,
}: {
  perms: Perms;
  applications: Application[];
  structure: IntakeStructure;
}) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const [term, setTerm] = React.useState('');
  const [filters, setFilters] = React.useState<
    Record<string, string | null | undefined>
  >({});
  const [sort, setSort] = React.useState<DirectorySort | null>(null);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(DEFAULT_PAGE_SIZE);

  React.useEffect(() => setPage(1), [term, filters, pageSize]);

  const columns: DirectoryColumn<Application>[] = [
    {
      id: 'applicantName',
      header: 'Applicant',
      sortable: true,
      cell: (a) => (
        <div className="flex items-center gap-3">
          <Avatar className="size-8">
            <AvatarFallback
              seed={a.applicantName}
              className="text-[calc(11px*var(--font-scale))] font-semibold"
            >
              {initials(a.applicantName)}
            </AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-col">
            <span className="break-words font-medium text-foreground">
              {a.applicantName}
            </span>
            <span className="break-words text-xs text-muted-foreground">
              {a.applyingFor}
            </span>
          </div>
        </div>
      ),
    },
    {
      id: 'guardianName',
      header: 'Primary guardian',
      hideable: true,
      cell: (a) => (
        <span className="text-muted-foreground">{a.guardianName}</span>
      ),
    },
    {
      id: 'submittedDate',
      header: 'Submitted',
      sortable: true,
      hideable: true,
      cell: (a) => (
        <span className="text-muted-foreground">
          {fmtDate(a.submittedDate)}
        </span>
      ),
    },
    {
      id: 'stage',
      header: 'Stage',
      sortable: true,
      cell: (a) => <StageBadge stage={a.stage} />,
    },
    {
      id: 'decision',
      header: 'Decision',
      sortable: true,
      cell: (a) => <DecisionBadge decision={a.decision} />,
    },
  ];

  const filtered = React.useMemo(() => {
    const q = term.trim().toLowerCase();
    const stage = filters.stage;
    const decision = filters.decision;
    let out = applications.filter((a) => {
      const matchesQ =
        !q ||
        a.applicantName.toLowerCase().includes(q) ||
        a.applyingFor.toLowerCase().includes(q) ||
        a.guardianName.toLowerCase().includes(q);
      const matchesStage = !stage || a.stage === stage;
      const matchesDecision = !decision || a.decision === decision;
      return matchesQ && matchesStage && matchesDecision;
    });
    if (sort) {
      const dir = sort.dir === 'desc' ? -1 : 1;
      const key = sort.field as keyof Application;
      out = [...out].sort(
        (a, b) =>
          dir * String(a[key] ?? '').localeCompare(String(b[key] ?? '')),
      );
    }
    return out;
  }, [applications, term, filters, sort]);

  // Clicking a KPI tile applies the exact filter that produced its number, so
  // the table shows those rows (toggle: clicking the active tile clears it).
  const stats: StatItem[] = React.useMemo(() => {
    const byStage = (s: string) =>
      applications.filter((a) => a.stage === s).length;
    const noFilters = !filters.stage && !filters.decision;
    const isReview = filters.decision === 'pending' && !filters.stage;
    const isOffers = filters.stage === 'offer' && !filters.decision;
    const isEnrolled = filters.stage === 'enrolled' && !filters.decision;
    return [
      {
        key: 'total',
        label: 'Applications',
        value: formatCount(applications.length),
        active: noFilters,
        onSelect: () => setFilters({}),
      },
      {
        key: 'review',
        label: 'In review',
        value: formatCount(
          applications.filter((a) => a.decision === 'pending').length,
        ),
        active: isReview,
        onSelect: () => setFilters(isReview ? {} : { decision: 'pending' }),
      },
      {
        key: 'offers',
        label: 'Offers out',
        value: formatCount(byStage('offer')),
        active: isOffers,
        onSelect: () => setFilters(isOffers ? {} : { stage: 'offer' }),
      },
      {
        key: 'enrolled',
        label: 'Enrolled',
        value: formatCount(byStage('enrolled')),
        active: isEnrolled,
        onSelect: () => setFilters(isEnrolled ? {} : { stage: 'enrolled' }),
      },
    ];
  }, [applications, filters]);

  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const hasQuery = term.trim() !== '' || Object.values(filters).some(Boolean);

  return (
    <ShellMain>
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Admissions"
          description="Track applicants from enquiry to enrolment — review, decide, and convert admits into students."
          actions={
            <>
              {perms.criteria && (
                <Button asChild variant="outline" size="sm">
                  <Link href="/students/admissions/forms">
                    <FileText /> Application form
                  </Link>
                </Button>
              )}
              {perms.create && (
                <Button size="sm" onClick={() => setCreateOpen(true)}>
                  <Plus /> New application
                </Button>
              )}
            </>
          }
        />

        <StatGrid items={stats} />

        <DirectoryTable<Application>
          title="Applications"
          description={`${filtered.length} of ${applications.length} applications`}
          columns={columns}
          rows={pageRows}
          getRowId={(a) => a.id}
          getRowLabel={(a) => a.applicantName}
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
          onRowClick={(a) => setSelectedId(a.id)}
          caption="Admissions pipeline"
          search={{
            value: term,
            onChange: setTerm,
            placeholder: 'Search applicant, class or guardian…',
            label: 'Search applications',
            id: 'admissions-search',
          }}
          filters={[
            {
              key: 'stage',
              label: 'Stage',
              options: STAGE_OPTIONS.map((s) => ({
                value: s,
                label: STAGE_LABEL[s] ?? titleCase(s),
              })),
            },
            {
              key: 'decision',
              label: 'Decision',
              options: DECISION_OPTIONS.map((d) => ({
                value: d,
                label: DECISION_LABEL[d] ?? titleCase(d),
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
                  : 'Submitted applications appear here.'
              }
            />
          }
        />
      </div>

      {/* Create sheet */}
      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
          <SheetHeader className="gap-1.5 border-b border-border px-5 pb-4 pt-5">
            <SheetTitle className="pr-8 font-display text-[calc(22px*var(--font-scale))] font-semibold leading-tight">
              New application
            </SheetTitle>
            <SheetDescription className="text-[calc(12.5px*var(--font-scale))]">
              Capture the applicant, what they&apos;re applying for, and their
              guardians. The requirement checklist is attached automatically.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-5 py-5">
            <NewApplicationForm
              structure={structure}
              onCancel={() => setCreateOpen(false)}
              onCreated={(id) => {
                setCreateOpen(false);
                router.refresh();
                setSelectedId(id);
              }}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* At-a-glance drawer */}
      <ApplicationDrawer
        applicationId={selectedId}
        onOpenChange={(open) => !open && setSelectedId(null)}
      />
    </ShellMain>
  );
}
