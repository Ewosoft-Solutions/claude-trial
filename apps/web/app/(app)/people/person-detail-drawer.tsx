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

/* ============================================================
   Folder-tab strip (design A)

   The header rule stops being a straight line under the tabs and
   becomes the active tab's own outline: it runs along, sweeps up into
   the tab's left side, over the crown, and back down the right.

   The joins use the SAME curve language as FlyoutContour — the shape
   that anchors a flyout to the collapsed sidebar rail. That curve is a
   cubic Bézier, not a circular arc: it flares CURVE_REACH (40) across
   only CURVE_SIZE (28), so the sweep is long and shallow rather than a
   tight quarter-round. The control-point ratios below (0.4 along the
   reach, 0.62 across the depth) are lifted from it directly, scaled to
   a tab. Circular `border-radius` cannot express this, which is why the
   join is an SVG.

   Two other details are load-bearing:
     · the RULE is painted as the scroll container's background — a 1px
       linear-gradient at its bottom edge — not a border, so the active
       tab (a descendant, painted above it) interrupts it just by being
       opaque. No negative margins fighting the scroller.
     · every tab keeps a transparent border of the same width as the
       active one's, so selecting a tab cannot shift the row by 1px.
   ============================================================ */

/** How far each join flares sideways from the tab. */
const FILLET_REACH = 16;
/** How far it rises from the rule before the tab's side goes vertical. */
const FILLET_DEPTH = 11;

function TabFillet({ side }: { side: 'left' | 'right' }) {
  const w = FILLET_REACH;
  const h = FILLET_DEPTH;
  // Half-pixel alignment, the same trick FlyoutContour uses. A 1px stroke on an
  // integer coordinate straddles two pixel columns at ~50% each, which renders
  // soft and reads a shade lighter than the crisp 1px CSS border it has to meet
  // — the seam. Putting the stroke on the CENTRE LINE of the pixel it should
  // occupy makes it land exactly:
  //   bx — the tab's side border occupies [w-1, w], so its centre is w-0.5
  //   by — the rule occupies the bottom pixel, so its centre is h-0.5
  // Ending the stroke on bx (not w) is also what squares the verticals: at w it
  // met the border's OUTER edge, half a pixel off, which showed as a lean.
  const bx = w - 0.5;
  const by = h - 0.5;
  // Sweeps from the rule (tangent horizontal) up to the tab's side (tangent
  // vertical) — FlyoutContour's easing: 0.4 along the reach, 0.62 across depth.
  const curve = `M 0 ${by} C ${bx * 0.4} ${by} ${bx} ${h * 0.62} ${bx} 0`;
  // The flare fills to the box edge so it covers the border pixel below the
  // join; the stroke above continues the tab's side from exactly that line.
  const flare = `M 0 ${h} C ${bx * 0.4} ${h} ${bx} ${h * 0.62} ${bx} 0 H ${w} V ${h} Z`;
  return (
    <svg
      aria-hidden
      focusable="false"
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className={cn(
        'pointer-events-none absolute bottom-0',
        side === 'left' ? '-left-4' : '-right-4 -scale-x-100',
      )}
    >
      {/* Erase the rule across the WHOLE join first. `--border` is translucent,
          so anywhere the strip's 1px rule still shows under the curve the two
          composite (0.1 over 0.1 reads as 0.19 — about double weight) and the
          join picks up a sketched, retraced look. The flare below cannot do
          this on its own: it has zero height at x=0 and only widens along the
          curve, so it masks progressively less towards the outer end — which is
          precisely where the doubling was worst. */}
      <rect x={0} y={h - 1} width={w} height={1} fill="var(--background)" />
      {/* Same for the other end: the tab's own 1px CSS border runs down this
          column, and the stroke lands on top of it. Erase the border's last
          `h` pixels so the curve alone draws the corner, then hands back to
          the border exactly at y=0 where this box ends. */}
      <rect x={w - 1} y={0} width={1} height={h} fill="var(--background)" />
      {/* the flare, filled with the CONTENT ground so the tab reads as attached
          to the panel below rather than to the lifted header behind it */}
      <path d={flare} fill="var(--background)" />
      {/* the rule itself, continuing up into the tab */}
      <path
        d={curve}
        fill="none"
        stroke="var(--border)"
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
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
  const hasTabs = tabs.length > 1;

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
            <SheetHeader
              className={cn(
                // `bg-sidebar` is the APP TOP BAR's surface (see AppHeader), so
                // the drawer's own top bar reads as the same piece of chrome.
                // Both sit over `--background`, so the composite is identical —
                // using the token rather than a copied value keeps them in
                // lockstep if the chrome is ever retuned.
                //
                // The body keeps the sheet's `bg-background`, the very token a
                // page's main region uses, so cards and inputs inside the drawer
                // sit on the same ground and lift the same way they do on a full
                // page. That contrast is also what gives the folder tab a panel
                // to attach to: the tab is filled with the body's ground, so it
                // reads as part of the content, cut out of the bar above it.
                'gap-3 bg-sidebar px-5 pt-5',
                // With tabs the strip paints the boundary itself, so the
                // header must not draw a second rule 16px below it.
                hasTabs ? 'pb-0' : 'border-b border-border pb-4',
              )}
            >
              <div className="flex items-center gap-3 pr-8">
                <AvatarLightbox name={detail.name} />
                <div className="min-w-0">
                  <SheetTitle className="truncate font-display text-[calc(22px*var(--font-scale))] font-semibold capitalize leading-tight">
                    {detail.name}
                  </SheetTitle>
                  <SheetDescription className="truncate text-[calc(12.5px*var(--font-scale))]">
                    {subtitleFor(detail)}
                  </SheetDescription>
                </div>
              </div>
              <ProfileChips profiles={detail.profiles} />
              <FlagChips flags={detail.flags} />
              {hasTabs ? (
                <div className="-mx-5 overflow-x-auto bg-[linear-gradient(to_top,var(--border)_0_1px,transparent_1px)] px-1">
                  {/* The 10px inset here is not decoration. Fillets are absolutely
                      positioned, so they add nothing to scrollWidth and a join on
                      the first or last tab is clipped the moment the strip scrolls.
                      Putting FILLET_REACH INSIDE the scrollable content gives both
                      joins room; the scroller carries the remaining 4px, so the
                      tabs still line up with the header's 20px inset. The gap
                      does NOT need to equal the reach — a join may run over a
                      neighbour's padding, which is ground-coloured anyway — and
                      widening it to match would push a fourth tab out of view in
                      a 384px drawer. */}
                  <div className="flex w-max items-end gap-3 px-4">
                    {tabs.map((t) => {
                      const active = t === tab;
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setTab(t)}
                          aria-current={active || undefined}
                          className={cn(
                            'relative shrink-0 rounded-t-[10px] border border-b-0 border-transparent px-3 pb-2 pt-2 text-[calc(13px*var(--font-scale))] transition-colors',
                            active
                              ? 'z-10 border-border bg-background font-semibold text-foreground'
                              : 'font-medium text-muted-foreground hover:text-foreground',
                          )}
                        >
                          {active ? (
                            <>
                              <TabFillet side="left" />
                              <TabFillet side="right" />
                            </>
                          ) : null}
                          {tabLabel(t)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </SheetHeader>

            <div className="@container/tiles flex-1 overflow-y-auto px-5 py-5">
              <TabBody tab={tab} detail={detail} onOpenPerson={onOpenPerson} />
            </div>

            {/* Same surface as the header: the bar above and the action bar below
                are one piece of chrome bracketing the content, which keeps
                `bg-background` to itself and reads as the page ground. */}
            <SheetFooter className="border-t border-border bg-sidebar px-5 py-4">
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
                  className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card p-2.5 text-sm"
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
              className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card p-2.5 text-sm"
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
