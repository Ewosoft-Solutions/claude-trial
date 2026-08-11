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
import { ExternalLink, FileText, Loader2, Plus } from 'lucide-react';

import { Avatar, AvatarFallback } from '@workspace/ui/components/avatar';
import { Button } from '@workspace/ui/components/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@workspace/ui/components/sheet';
import { PageHeader } from '@workspace/ui/custom/shell/page-header';
import { ShellMain } from '@workspace/ui/custom/shell/app-shell';
import { StatGrid } from '@workspace/ui/custom/layouts/stat-grid';
import { StatusBadge } from '@workspace/ui/custom/data-display/status-badge';
import { EmptyState } from '@workspace/ui/custom/states/page-states';
import {
  DirectoryTable,
  type DirectoryColumn,
} from '@workspace/ui/custom/tables/directory-table';
import type { StatItem } from '@workspace/ui/types/layout.types';
import type { DirectorySort } from '@workspace/ui/lib/directory-state';

import { DEFAULT_PAGE_SIZE } from '@/lib/page-size';
import { formatCount } from '@/lib/format';

import { NewApplicationForm } from './new-application-form';
import {
  COLLECT_STAGE_LABEL,
  REQUIREMENT_STATUS_TONE,
  STAGE_TONE,
  fmtDate,
  type Application,
  type ApplicationDetail,
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

const DECISION_TONE: Record<
  string,
  React.ComponentProps<typeof StatusBadge>['tone']
> = {
  pending: 'warning',
  accepted: 'success',
  waitlisted: 'info',
  rejected: 'destructive',
};

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

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
      cell: (a) => (
        <StatusBadge tone={STAGE_TONE[a.stage] ?? 'neutral'}>
          {titleCase(a.stage)}
        </StatusBadge>
      ),
    },
    {
      id: 'decision',
      header: 'Decision',
      sortable: true,
      cell: (a) => (
        <StatusBadge tone={DECISION_TONE[a.decision] ?? 'neutral'} dot>
          {titleCase(a.decision)}
        </StatusBadge>
      ),
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

  const stats: StatItem[] = React.useMemo(() => {
    const byStage = (s: string) =>
      applications.filter((a) => a.stage === s).length;
    return [
      {
        key: 'total',
        label: 'Applications',
        value: formatCount(applications.length),
      },
      {
        key: 'review',
        label: 'In review',
        value: formatCount(
          applications.filter((a) => a.decision === 'pending').length,
        ),
      },
      {
        key: 'offers',
        label: 'Offers out',
        value: formatCount(byStage('offer')),
      },
      {
        key: 'enrolled',
        label: 'Enrolled',
        value: formatCount(byStage('enrolled')),
      },
    ];
  }, [applications]);

  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const hasQuery = term.trim() !== '' || Object.values(filters).some(Boolean);

  return (
    <ShellMain>
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Admissions"
          description="Capture applications against the school's own classes, collect the requirement checklist at each stage, and convert an accepted applicant into a registered student in one command."
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
                label: titleCase(s),
              })),
            },
            {
              key: 'decision',
              label: 'Decision',
              options: DECISION_OPTIONS.map((d) => ({
                value: d,
                label: titleCase(d),
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
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader className="mb-4">
            <SheetTitle>New application</SheetTitle>
            <SheetDescription>
              Capture the applicant, what they&apos;re applying for, and their
              guardians. The requirement checklist is attached automatically.
            </SheetDescription>
          </SheetHeader>
          <NewApplicationForm
            structure={structure}
            onCancel={() => setCreateOpen(false)}
            onCreated={(id) => {
              setCreateOpen(false);
              router.refresh();
              setSelectedId(id);
            }}
          />
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

function ApplicationDrawer({
  applicationId,
  onOpenChange,
}: {
  applicationId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [detail, setDetail] = React.useState<ApplicationDetail | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!applicationId) {
      setDetail(null);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setDetail(null);
    fetch(`/api/admissions/applications/${applicationId}`, {
      signal: controller.signal,
    })
      .then((res) =>
        res.ok ? (res.json() as Promise<ApplicationDetail>) : null,
      )
      .then((data) => setDetail(data))
      .catch(() => undefined)
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [applicationId]);

  const requirements = detail?.requirements ?? [];
  const provided = requirements.filter((r) => r.status !== 'pending').length;

  return (
    <Sheet open={applicationId !== null} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-md">
        {loading || !detail ? (
          <div className="flex h-full items-center justify-center">
            <SheetTitle className="sr-only">Loading application</SheetTitle>
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            <SheetHeader className="gap-1">
              <div className="flex items-center gap-2">
                <SheetTitle className="text-xl">
                  {detail.applicantName}
                </SheetTitle>
                <StatusBadge tone={STAGE_TONE[detail.stage] ?? 'neutral'}>
                  {detail.stage}
                </StatusBadge>
              </div>
              <SheetDescription>
                Applying for {detail.applyingFor}
                {detail.resultingStudentId ? ' · enrolled as a student' : ''}
              </SheetDescription>
            </SheetHeader>

            {/* Profile */}
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <Field
                label="Date of birth"
                value={fmtDate(detail.dateOfBirth)}
              />
              <Field label="Gender" value={detail.gender ?? '—'} />
              <Field
                label="State of origin"
                value={detail.stateOfOrigin ?? '—'}
              />
              <Field label="Religion" value={detail.religion ?? '—'} />
            </dl>

            {/* Guardians */}
            <section className="flex flex-col gap-2">
              <h4 className="text-sm font-semibold">Guardians</h4>
              {detail.guardians.length === 0 ? (
                <p className="text-sm text-muted-foreground">None recorded.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {detail.guardians.map((g, i) => (
                    <li
                      key={g.id ?? i}
                      className="rounded-md border border-border p-2.5 text-sm"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{g.fullName}</span>
                        <span className="text-xs capitalize text-muted-foreground">
                          {g.relationship}
                          {g.isPrimary ? ' · primary' : ''}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {g.phoneCountryCode} {g.phoneNumber}
                        {g.whatsappSameAsPhone
                          ? ' · WhatsApp same'
                          : g.whatsappNumber
                            ? ` · WhatsApp ${g.whatsappCountryCode ?? ''} ${g.whatsappNumber}`
                            : ''}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Requirements progress */}
            <section className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">Requirements</h4>
                <span className="text-xs text-muted-foreground">
                  {provided}/{requirements.length} handled
                </span>
              </div>
              {requirements.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No checklist attached.
                </p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {requirements.slice(0, 6).map((r) => (
                    <li
                      key={r.id}
                      className="flex items-center justify-between gap-2 text-sm"
                    >
                      <span className="truncate">
                        {r.label}
                        <span className="ml-1 text-xs text-muted-foreground">
                          (
                          {COLLECT_STAGE_LABEL[r.collectStage] ??
                            r.collectStage}
                          )
                        </span>
                      </span>
                      <StatusBadge
                        tone={REQUIREMENT_STATUS_TONE[r.status] ?? 'neutral'}
                      >
                        {r.status}
                      </StatusBadge>
                    </li>
                  ))}
                  {requirements.length > 6 && (
                    <li className="text-xs text-muted-foreground">
                      +{requirements.length - 6} more on the detail page
                    </li>
                  )}
                </ul>
              )}
            </section>

            <SheetFooter>
              <Button asChild className="w-full">
                <Link href={`/students/admissions/${detail.id}`}>
                  Open full detail
                  <ExternalLink className="ml-1 size-4" aria-hidden />
                </Link>
              </Button>
            </SheetFooter>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="capitalize">{value}</dd>
    </div>
  );
}
