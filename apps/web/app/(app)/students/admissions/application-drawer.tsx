'use client';

/**
 * ApplicationDrawer — the admissions at-a-glance drill-in.
 *
 * Opens on a row click. Fetches the application (/api/admissions/applications/
 * [id]) and shows it in a TABBED drawer (Overview / Requirements / History) —
 * modelled on the People directory drawer, using the shared design-system
 * detail primitives (Section / DetailGrid / Field / StatTiles). "Open full
 * detail" routes to /students/admissions/[id].
 */
import * as React from 'react';
import Link from 'next/link';
import { ExternalLink, Loader2 } from 'lucide-react';

import { cn } from '@workspace/ui/lib/utils';
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
import { StatusBadge } from '@workspace/ui/custom/data-display/status-badge';
import { ErrorState } from '@workspace/ui/custom/states/page-states';
import {
  DetailGrid,
  Field,
  Section,
  StatTiles,
} from '@workspace/ui/custom/detail/detail-primitives';

import {
  COLLECT_STAGE_LABEL,
  fmtDate,
  fmtDateTime,
  type ApplicationDetail,
  type Requirement,
} from './admissions-types';
import {
  StageBadge,
  DecisionBadge,
  RequirementStatusBadge,
  titleCase,
} from '@/lib/admissions/status';

const COLLECT_STAGE_ORDER = ['application', 'offer', 'acceptance', 'enrolment'];

const DRAWER_TABS = ['overview', 'requirements', 'history'] as const;
type DrawerTab = (typeof DRAWER_TABS)[number];
const TAB_LABEL: Record<DrawerTab, string> = {
  overview: 'Overview',
  requirements: 'Requirements',
  history: 'History',
};

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0] ?? '')
    .join('')
    .toUpperCase();
}

export function ApplicationDrawer({
  applicationId,
  onOpenChange,
}: {
  applicationId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [detail, setDetail] = React.useState<ApplicationDetail | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(false);
  const [tab, setTab] = React.useState<DrawerTab>('overview');

  React.useEffect(() => {
    if (!applicationId) return;
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    setDetail(null);
    setTab('overview');
    fetch(`/api/admissions/applications/${applicationId}`, {
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.json() as Promise<ApplicationDetail>;
      })
      .then((data) => setDetail(data))
      .catch((err) => {
        if (err?.name !== 'AbortError') setError(true);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [applicationId]);

  const busy = loading || (!detail && !error);

  return (
    <Sheet open={applicationId !== null} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 p-0 sm:max-w-lg">
        {busy ? (
          <div className="flex h-full items-center justify-center">
            <SheetTitle className="sr-only">Loading application</SheetTitle>
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : error || !detail ? (
          <div className="flex h-full items-center p-4">
            <SheetTitle className="sr-only">Application unavailable</SheetTitle>
            <ErrorState
              compact
              title="Couldn't load this application"
              description="Please close and try again."
            />
          </div>
        ) : (
          <>
            <SheetHeader className="gap-3 border-b border-border px-5 pb-4 pt-5">
              <div className="flex items-center gap-3 pr-8">
                <Avatar className="size-10">
                  <AvatarFallback
                    seed={detail.applicantName}
                    className="text-[calc(13px*var(--font-scale))] font-semibold"
                  >
                    {initials(detail.applicantName)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <SheetTitle className="truncate font-display text-[calc(22px*var(--font-scale))] font-semibold capitalize leading-tight">
                    {detail.applicantName}
                  </SheetTitle>
                  <SheetDescription className="truncate text-[calc(12.5px*var(--font-scale))]">
                    Applying for {detail.applyingFor}
                    {detail.resultingStudentId ? ' · enrolled' : ''}
                  </SheetDescription>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <StageBadge stage={detail.stage} />
                <DecisionBadge decision={detail.decision} />
              </div>
              <div className="-mb-1 flex gap-1 overflow-x-auto">
                {DRAWER_TABS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTab(t)}
                    className={cn(
                      'shrink-0 rounded-md px-2.5 py-1 text-[calc(13px*var(--font-scale))] font-medium transition-colors',
                      t === tab
                        ? 'bg-accent text-foreground'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {TAB_LABEL[t]}
                  </button>
                ))}
              </div>
            </SheetHeader>

            <div className="@container/tiles flex-1 overflow-y-auto px-5 py-5">
              <DrawerBody tab={tab} detail={detail} />
            </div>

            <SheetFooter className="border-t border-border px-5 py-4">
              <Button asChild className="w-full">
                <Link href={`/students/admissions/${detail.id}`}>
                  <ExternalLink aria-hidden /> Open full detail
                </Link>
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function DrawerBody({
  tab,
  detail,
}: {
  tab: DrawerTab;
  detail: ApplicationDetail;
}) {
  if (tab === 'requirements') return <RequirementsTab detail={detail} />;
  if (tab === 'history') return <HistoryTab detail={detail} />;
  return <OverviewTab detail={detail} />;
}

function OverviewTab({ detail }: { detail: ApplicationDetail }) {
  const requirements = detail.requirements ?? [];
  const provided = requirements.filter((r) => r.status !== 'pending').length;
  const reviews = detail.reviews ?? [];
  const guardians = detail.guardians ?? [];

  return (
    <div className="flex flex-col gap-6">
      <StatTiles
        items={[
          {
            key: 'req',
            label: 'Requirements',
            value: `${provided}/${requirements.length}`,
          },
          { key: 'reviews', label: 'Reviews', value: reviews.length },
          {
            key: 'submitted',
            label: 'Submitted',
            value: fmtDate(detail.submittedDate),
          },
        ]}
      />

      <Section title="Applicant">
        <DetailGrid>
          <Field label="Date of birth" value={fmtDate(detail.dateOfBirth)} />
          <Field
            label="Gender"
            value={detail.gender ? titleCase(detail.gender) : null}
          />
          <Field label="State of origin" value={detail.stateOfOrigin} />
          <Field label="Religion" value={detail.religion} />
          {detail.healthNotes ? (
            <div className="col-span-2">
              <Field label="Health notes" value={detail.healthNotes} />
            </div>
          ) : null}
        </DetailGrid>
      </Section>

      <Section
        title={`Guardians${guardians.length ? ` (${guardians.length})` : ''}`}
      >
        {guardians.length === 0 ? (
          <p className="text-sm text-muted-foreground">None recorded.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {guardians.map((g, i) => (
              <div
                key={g.id ?? i}
                className="flex items-center gap-2.5 rounded-lg border border-border bg-card/40 p-2.5"
              >
                <Avatar className="size-8">
                  <AvatarFallback
                    seed={g.fullName ?? ''}
                    className="text-[calc(10px*var(--font-scale))] font-semibold"
                  >
                    {initials(g.fullName ?? '')}
                  </AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium text-foreground">
                    {g.fullName}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {titleCase(g.relationship)} · {g.phoneCountryCode}{' '}
                    {g.phoneNumber}
                  </span>
                </div>
                {g.isPrimary ? (
                  <StatusBadge tone="info" dot>
                    Primary
                  </StatusBadge>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function RequirementsTab({ detail }: { detail: ApplicationDetail }) {
  const grouped = React.useMemo(() => {
    const by: Record<string, Requirement[]> = {};
    for (const r of detail.requirements ?? [])
      (by[r.collectStage] ??= []).push(r);
    return by;
  }, [detail.requirements]);
  const stages = COLLECT_STAGE_ORDER.filter((s) => grouped[s]?.length);

  if ((detail.requirements?.length ?? 0) === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No requirement checklist attached.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {stages.map((stage) => (
        <Section
          key={stage}
          title={COLLECT_STAGE_LABEL[stage] ?? titleCase(stage)}
        >
          <div className="flex flex-col gap-1.5">
            {grouped[stage]!.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card/40 p-2.5 text-sm"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium text-foreground">
                    {r.label}
                    {r.required ? (
                      <span className="ml-1 text-destructive">*</span>
                    ) : null}
                  </div>
                  <div className="truncate text-xs capitalize text-muted-foreground">
                    {r.type}
                  </div>
                </div>
                <RequirementStatusBadge status={r.status} />
              </div>
            ))}
          </div>
        </Section>
      ))}
    </div>
  );
}

function HistoryTab({ detail }: { detail: ApplicationDetail }) {
  const events = detail.stageEvents ?? [];
  const reviews = detail.reviews ?? [];

  return (
    <div className="flex flex-col gap-6">
      <Section title="Stage history">
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No stage history yet.</p>
        ) : (
          <ol className="flex flex-col">
            {events.map((e, i) => (
              <li key={e.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span
                    className={cn(
                      'mt-0.5 size-3 shrink-0 rounded-full border-2',
                      i === events.length - 1
                        ? 'border-primary bg-primary'
                        : 'border-border bg-background',
                    )}
                  />
                  {i < events.length - 1 ? (
                    <span className="my-0.5 w-px flex-1 bg-border" />
                  ) : null}
                </div>
                <div className="min-w-0 pb-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <StageBadge stage={e.toStage} />
                    <span className="text-xs text-muted-foreground">
                      {fmtDateTime(e.createdAt)}
                    </span>
                  </div>
                  {e.note ? (
                    <span className="text-xs text-muted-foreground">
                      {e.note}
                    </span>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        )}
      </Section>

      {reviews.length > 0 ? (
        <Section title={`Reviews (${reviews.length})`}>
          <div className="flex flex-col gap-1.5">
            {reviews.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card/40 p-2.5 text-sm"
              >
                <div className="min-w-0">
                  <div className="font-medium capitalize text-foreground">
                    {r.recommendation}
                  </div>
                  {r.note ? (
                    <div className="truncate text-xs text-muted-foreground">
                      {r.note}
                    </div>
                  ) : null}
                </div>
                {r.score != null ? (
                  <StatusBadge tone="info">{r.score}</StatusBadge>
                ) : null}
              </div>
            ))}
          </div>
        </Section>
      ) : null}
    </div>
  );
}
