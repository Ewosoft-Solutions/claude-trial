'use client';

/* ============================================================
   PersonDetailDrawer — the People directory drill-in (WB1-1+)

   Opens on a row click. Fetches the governed per-person detail
   (/api/directory/people/[id]?type=) and shows it in a TABBED
   drawer (Overview / People / Academics / Finance / Documents —
   only the tabs the persona + permissions allow). Ward ↔ guardian
   (and sibling) cross-links hop between people without leaving the
   directory; "Open full profile" routes to /people/[id].
   ============================================================ */

import * as React from 'react';
import Link from 'next/link';
import { ExternalLink, Loader2, Mail } from 'lucide-react';

import { cn } from '@workspace/ui/lib/utils';
import { Button } from '@workspace/ui/components/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@workspace/ui/components/sheet';
import { ErrorState } from '@workspace/ui/custom/states/page-states';

import type { PeopleType } from './people-config';
import {
  availableTabs,
  formatDate,
  formatMinor,
  humanize,
  tabLabel,
  type DetailTab,
  type PersonDetail,
} from './person-detail.types';
import { AvatarLightbox } from './avatar-lightbox';
import {
  FlagChips,
  PersonOverview,
  PersonPeople,
  ProfileChips,
  Section,
  StatTiles,
} from './person-detail-ui';

export interface PersonDetailDrawerProps {
  personId: string | null;
  type: PeopleType;
  onOpenChange: (open: boolean) => void;
  onOpenPerson: (id: string) => void;
}

function subtitleFor(detail: PersonDetail): string {
  if (detail.type === 'prospect' && detail.prospect) {
    return `Prospect · applying for ${detail.prospect.applyingFor}`;
  }
  if (detail.student?.gradeLevel)
    return `Student · ${detail.student.gradeLevel}`;
  if (detail.staff?.[0]?.jobTitle) return `Staff · ${detail.staff[0].jobTitle}`;
  if (detail.wards && detail.wards.length > 0) {
    return `Guardian · ${detail.wards.length} ward${detail.wards.length === 1 ? '' : 's'}`;
  }
  return detail.profiles.length > 0 ? 'Person' : 'No roles yet';
}

export function PersonDetailDrawer({
  personId,
  type,
  onOpenChange,
  onOpenPerson,
}: PersonDetailDrawerProps) {
  const [detail, setDetail] = React.useState<PersonDetail | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(false);
  const [tab, setTab] = React.useState<DetailTab>('overview');

  React.useEffect(() => {
    if (!personId) return;
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    setDetail(null);
    setTab('overview');
    fetch(
      `/api/directory/people/${personId}?type=${encodeURIComponent(type)}`,
      {
        signal: controller.signal,
      },
    )
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.json() as Promise<PersonDetail>;
      })
      .then((data) => setDetail(data))
      .catch((err) => {
        if (err?.name !== 'AbortError') setError(true);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [personId, type]);

  const busy = loading || (!detail && !error);
  const tabs = detail ? availableTabs(detail) : [];

  return (
    <Sheet open={personId !== null} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 p-0 sm:max-w-lg">
        {busy ? (
          <div className="flex h-full items-center justify-center">
            <SheetTitle className="sr-only">Loading person</SheetTitle>
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : error || !detail ? (
          <div className="flex h-full items-center p-4">
            <SheetTitle className="sr-only">Person unavailable</SheetTitle>
            <ErrorState
              compact
              title="Couldn't load this person"
              description="Please close and try again."
            />
          </div>
        ) : (
          <>
            <SheetHeader className="gap-3 border-b border-border px-5 pb-4 pt-5">
              <div className="flex items-center gap-3 pr-8">
                <AvatarLightbox name={detail.name} />
                <div className="min-w-0">
                  <SheetTitle className="truncate font-display text-[22px] font-semibold capitalize leading-tight">
                    {detail.name}
                  </SheetTitle>
                  <SheetDescription className="truncate text-[12.5px]">
                    {subtitleFor(detail)}
                  </SheetDescription>
                </div>
              </div>
              <ProfileChips profiles={detail.profiles} />
              <FlagChips flags={detail.flags} />
              {tabs.length > 1 ? (
                <div className="-mb-1 flex gap-1 overflow-x-auto">
                  {tabs.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTab(t)}
                      className={cn(
                        'shrink-0 rounded-md px-2.5 py-1 text-[13px] font-medium transition-colors',
                        t === tab
                          ? 'bg-accent text-foreground'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {tabLabel(t)}
                    </button>
                  ))}
                </div>
              ) : null}
            </SheetHeader>

            <div className="@container/tiles flex-1 overflow-y-auto px-5 py-5">
              <TabBody tab={tab} detail={detail} onOpenPerson={onOpenPerson} />
            </div>

            <SheetFooter className="border-t border-border px-5 py-4">
              <Button asChild className="w-full">
                <Link href={`/people/${detail.id}?type=${detail.type}`}>
                  <ExternalLink aria-hidden /> Open full profile
                </Link>
              </Button>
              {detail.email && !detail.contactMasked ? (
                <Button asChild variant="outline" className="w-full">
                  <a href={`mailto:${detail.email}`}>
                    <Mail aria-hidden /> Send email
                  </a>
                </Button>
              ) : null}
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function TabBody({
  tab,
  detail,
  onOpenPerson,
}: {
  tab: DetailTab;
  detail: PersonDetail;
  onOpenPerson: (id: string) => void;
}) {
  if (tab === 'people') {
    return <PersonPeople detail={detail} onSelect={onOpenPerson} />;
  }

  if (tab === 'academics' && detail.academics) {
    const a = detail.academics;
    return (
      <div className="flex flex-col gap-6">
        <StatTiles
          items={[
            {
              key: 'att',
              label: 'Attendance',
              value:
                a.attendancePercent != null ? `${a.attendancePercent}%` : '—',
              tone:
                a.attendancePercent != null && a.attendancePercent < 85
                  ? 'warning'
                  : undefined,
            },
            {
              key: 'grade',
              label: 'Avg grade',
              value:
                a.averageGradePercent != null
                  ? `${a.averageGradePercent}%`
                  : '—',
            },
            {
              key: 'classes',
              label: 'Classes',
              value: a.currentClasses.length,
            },
          ]}
        />
        {a.currentClasses.length > 0 ? (
          <Section title="Classes">
            <div className="flex flex-col gap-1.5">
              {a.currentClasses.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card/40 p-2.5 text-sm"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium text-foreground">
                      {c.name}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {[c.term, humanize(c.status)].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  {c.finalGrade ? (
                    <span className="shrink-0 text-sm font-semibold text-foreground">
                      {c.finalGrade}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          </Section>
        ) : null}
      </div>
    );
  }

  if (tab === 'finance' && detail.finance) {
    const f = detail.finance;
    return (
      <StatTiles
        items={[
          {
            key: 'bal',
            label: 'Balance',
            value: formatMinor(f.balance),
            tone: f.balance > 0 ? 'destructive' : undefined,
          },
          { key: 'paid', label: 'Paid', value: formatMinor(f.totalPaid) },
          {
            key: 'overdue',
            label: 'Overdue',
            value: f.overdueCount,
            tone: f.overdueCount > 0 ? 'destructive' : undefined,
          },
          {
            key: 'due',
            label: 'Next due',
            value: formatDate(f.nextDueDate) ?? '—',
          },
        ]}
      />
    );
  }

  if (tab === 'documents' && detail.documents) {
    return (
      <Section title={`Documents (${detail.documents.count})`}>
        <div className="flex flex-col gap-1.5">
          {detail.documents.recent.slice(0, 5).map((d) => (
            <div
              key={d.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card/40 p-2.5 text-sm"
            >
              <div className="min-w-0">
                <div className="truncate font-medium text-foreground">
                  {d.title}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {[d.type, formatDate(d.createdAt)]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Section>
    );
  }

  return <PersonOverview detail={detail} />;
}
