'use client';

/**
 * WB3 structured-intake · Admissions workspace (list).
 *
 * Full-width Applications table; "New application" opens the structured cascade
 * form in a side sheet. Clicking a row opens an at-a-glance drawer (applicant,
 * guardians, requirement progress, stage) with a link through to the full
 * detail/edit page.
 */
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ExternalLink, Loader2, Plus, Search } from 'lucide-react';

import { Button } from '@workspace/ui/components/button';
import { Input } from '@workspace/ui/components/input';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@workspace/ui/components/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@workspace/ui/components/table';
import { StatusBadge } from '@workspace/ui/custom/data-display/status-badge';
import { EmptyState } from '@workspace/ui/custom/states/page-states';

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
  const [q, setQ] = React.useState('');

  const filtered = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return applications;
    return applications.filter(
      (a) =>
        a.applicantName.toLowerCase().includes(needle) ||
        a.applyingFor.toLowerCase().includes(needle) ||
        a.guardianName.toLowerCase().includes(needle),
    );
  }, [applications, q]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative max-w-xs flex-1">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search applicant, class or guardian…"
            className="pl-8"
          />
        </div>
        {perms.create && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1 size-4" aria-hidden /> New application
          </Button>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        {filtered.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title={
                applications.length === 0 ? 'No applications yet' : 'No matches'
              }
              description={
                applications.length === 0
                  ? 'Submitted applications appear here.'
                  : 'Try a different search.'
              }
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Applicant</TableHead>
                <TableHead>Applying for</TableHead>
                <TableHead className="hidden sm:table-cell">
                  Primary guardian
                </TableHead>
                <TableHead className="hidden md:table-cell">
                  Submitted
                </TableHead>
                <TableHead>Stage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((a) => (
                <TableRow
                  key={a.id}
                  onClick={() => setSelectedId(a.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedId(a.id);
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label={`Open ${a.applicantName}`}
                  className="cursor-pointer"
                >
                  <TableCell className="font-medium">
                    {a.applicantName}
                  </TableCell>
                  <TableCell>{a.applyingFor}</TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground">
                    {a.guardianName}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {fmtDate(a.submittedDate)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge tone={STAGE_TONE[a.stage] ?? 'neutral'}>
                      {a.stage}
                    </StatusBadge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
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
    </div>
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
                <Link href={`/admissions/${detail.id}`}>
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
