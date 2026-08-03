'use client';

/* ============================================================
   PersonDetailDrawer — the People directory drill-in (WB1-1+)

   Opens on a row click. Fetches the governed per-person detail
   (/api/directory/people/[id]?type=), renders identity + contact
   (mailto/tel) + the role sections the caller may see, and lets
   you hop between related people (a ward ↔ a guardian) without
   leaving the directory. "Open full profile" routes to the
   dedicated /people/[id] page.

   Styled to the Aurora inspector language: display-font name, small
   muted section labels over a 2-column value grid, bordered
   relationship cards, and a pinned footer action.
   ============================================================ */

import * as React from 'react';
import Link from 'next/link';
import {
  Briefcase,
  ChevronRight,
  ExternalLink,
  GraduationCap,
  Loader2,
  Mail,
  Phone,
  UserCog,
  Users,
} from 'lucide-react';

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
import { MaskedValue } from '@workspace/ui/custom/tables/directory-table';
import { ErrorState } from '@workspace/ui/custom/states/page-states';

import type { PeopleType } from './people-config';

export interface PersonDetailRelation {
  id: string;
  name: string;
  relationship: string;
  isPrimary: boolean;
}

export interface PersonDetail {
  id: string;
  type: PeopleType;
  name: string;
  profiles: ('student' | 'guardian' | 'staff' | 'user')[];
  email: string | null;
  phone: string | null;
  contactMasked: boolean;
  student: {
    studentNumber: string | null;
    gradeLevel: string | null;
    enrollmentStatus: string | null;
    guardians: PersonDetailRelation[];
  } | null;
  staff:
    | {
        employeeNumber: string | null;
        jobTitle: string | null;
        department: string | null;
        employmentStatus: string;
        employmentType: string | null;
      }[]
    | null;
  wards: PersonDetailRelation[] | null;
  account: { status: string; email: string | null } | null;
  prospect: {
    applyingFor: string;
    guardianName: string;
    stage: string;
    decision: string | null;
  } | null;
}

const PROFILE_META: Record<string, { label: string; icon: React.ReactNode }> = {
  student: { label: 'Student', icon: <GraduationCap className="size-3" /> },
  guardian: { label: 'Guardian', icon: <Users className="size-3" /> },
  staff: { label: 'Staff', icon: <Briefcase className="size-3" /> },
  user: { label: 'User', icon: <UserCog className="size-3" /> },
};

function initials(name: string): string {
  return (
    name
      .split(' ')
      .slice(0, 2)
      .map((p) => p[0])
      .join('')
      .toUpperCase() || '?'
  );
}

/** 'on_leave' → 'On leave'. */
function humanize(value: string): string {
  const s = value.replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** A one-line role summary for the header subtitle. */
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
  return detail.profiles.length > 0
    ? detail.profiles.map((p) => PROFILE_META[p]?.label ?? p).join(' · ')
    : 'No roles yet';
}

export interface PersonDetailDrawerProps {
  /** The person to show; `null` closes the drawer. */
  personId: string | null;
  /** The active tab type (forwarded so the server gates the type permission). */
  type: PeopleType;
  onOpenChange: (open: boolean) => void;
  /** Open another person's detail (used by ward ↔ guardian cross-links). */
  onOpenPerson: (id: string) => void;
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

  React.useEffect(() => {
    if (!personId) return;
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    setDetail(null);
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

  return (
    <Sheet open={personId !== null} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 p-0 sm:max-w-md">
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
            {/* Header */}
            <SheetHeader className="gap-3 border-b border-border px-5 pb-4 pt-5">
              <div className="flex items-center gap-3 pr-8">
                <Avatar className="size-12">
                  <AvatarFallback
                    seed={detail.name}
                    className="text-sm font-semibold"
                  >
                    {initials(detail.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <SheetTitle className="truncate font-display text-[22px] font-bold leading-tight">
                    {detail.name}
                  </SheetTitle>
                  <SheetDescription className="truncate text-[12.5px]">
                    {subtitleFor(detail)}
                  </SheetDescription>
                </div>
              </div>
              {detail.profiles.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {detail.profiles.map((p) => (
                    <Chip key={p} icon={PROFILE_META[p]?.icon}>
                      {PROFILE_META[p]?.label ?? p}
                    </Chip>
                  ))}
                </div>
              ) : null}
            </SheetHeader>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-5">
              <div className="flex flex-col gap-6">
                {detail.email || detail.phone ? (
                  <Section title="Contact">
                    <div className="flex flex-col gap-2 rounded-lg border border-border bg-card/40 p-3">
                      {detail.email ? (
                        <ContactRow
                          icon={<Mail className="size-4" />}
                          value={detail.email}
                          href={`mailto:${detail.email}`}
                          masked={detail.contactMasked}
                        />
                      ) : null}
                      {detail.phone ? (
                        <ContactRow
                          icon={<Phone className="size-4" />}
                          value={detail.phone}
                          href={`tel:${detail.phone}`}
                          masked={detail.contactMasked}
                        />
                      ) : null}
                    </div>
                  </Section>
                ) : null}

                {detail.student ? (
                  <Section title="Student">
                    <Grid>
                      <Detail
                        label="Student no."
                        value={detail.student.studentNumber}
                      />
                      <Detail label="Grade" value={detail.student.gradeLevel} />
                      <Detail
                        label="Enrollment"
                        value={
                          detail.student.enrollmentStatus
                            ? humanize(detail.student.enrollmentStatus)
                            : null
                        }
                      />
                    </Grid>
                    {detail.student.guardians.length > 0 ? (
                      <RelationList
                        label="Guardians"
                        relations={detail.student.guardians}
                        onOpenPerson={onOpenPerson}
                      />
                    ) : null}
                  </Section>
                ) : null}

                {detail.staff && detail.staff.length > 0 ? (
                  <Section
                    title={detail.staff.length > 1 ? 'Employment' : 'Staff'}
                  >
                    <div className="flex flex-col gap-2">
                      {detail.staff.map((s, i) => (
                        <div
                          key={s.employeeNumber ?? i}
                          className="rounded-lg border border-border bg-card/40 p-3"
                        >
                          <div className="mb-2 flex items-center gap-2 font-medium text-foreground">
                            <Briefcase className="size-4 text-muted-foreground" />
                            {s.jobTitle ?? s.employeeNumber ?? 'Staff'}
                          </div>
                          <Grid>
                            <Detail label="Department" value={s.department} />
                            <Detail
                              label="Status"
                              value={humanize(s.employmentStatus)}
                            />
                            {s.employmentType ? (
                              <Detail
                                label="Type"
                                value={humanize(s.employmentType)}
                              />
                            ) : null}
                            <Detail
                              label="Employee no."
                              value={s.employeeNumber}
                            />
                          </Grid>
                        </div>
                      ))}
                    </div>
                  </Section>
                ) : null}

                {detail.wards && detail.wards.length > 0 ? (
                  <Section title="Wards">
                    <RelationList
                      relations={detail.wards}
                      onOpenPerson={onOpenPerson}
                    />
                  </Section>
                ) : null}

                {detail.account ? (
                  <Section title="Account">
                    <Grid>
                      <Detail
                        label="Status"
                        value={humanize(detail.account.status)}
                      />
                      <Detail
                        label="Login email"
                        value={detail.account.email}
                      />
                    </Grid>
                  </Section>
                ) : null}

                {detail.prospect ? (
                  <Section title="Application">
                    <Grid>
                      <Detail
                        label="Applying for"
                        value={detail.prospect.applyingFor}
                      />
                      <Detail
                        label="Guardian"
                        value={detail.prospect.guardianName}
                      />
                      <Detail
                        label="Stage"
                        value={humanize(detail.prospect.stage)}
                      />
                      <Detail
                        label="Decision"
                        value={
                          detail.prospect.decision
                            ? humanize(detail.prospect.decision)
                            : null
                        }
                      />
                    </Grid>
                  </Section>
                ) : null}
              </div>
            </div>

            {/* Footer */}
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

function Chip({
  icon,
  children,
}: {
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
      {icon ? <span aria-hidden>{icon}</span> : null}
      {children}
    </span>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2.5">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-x-4 gap-y-3.5">{children}</div>;
}

/** A stacked label-over-value cell (the Aurora inspector field). */
function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="break-words text-sm font-medium text-foreground">
        {value ?? '—'}
      </span>
    </div>
  );
}

function ContactRow({
  icon,
  value,
  href,
  masked,
}: {
  icon: React.ReactNode;
  value: string;
  href: string;
  masked: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5 text-sm">
      <span className="shrink-0 text-muted-foreground">{icon}</span>
      {masked ? (
        <MaskedValue value={value} masked />
      ) : (
        <a
          href={href}
          className="truncate text-foreground hover:text-primary hover:underline"
        >
          {value}
        </a>
      )}
    </div>
  );
}

function RelationList({
  label,
  relations,
  onOpenPerson,
}: {
  label?: string;
  relations: PersonDetailRelation[];
  onOpenPerson: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {label ? (
        <span className="text-xs text-muted-foreground">{label}</span>
      ) : null}
      {relations.map((r) => (
        <button
          key={r.id}
          type="button"
          onClick={() => onOpenPerson(r.id)}
          className={cn(
            'flex items-center gap-2.5 rounded-lg border border-border bg-card/40 p-2.5 text-left',
            'transition-colors hover:border-ring/60 hover:bg-accent/40',
          )}
        >
          <Avatar className="size-8">
            <AvatarFallback seed={r.name} className="text-[10px] font-semibold">
              {initials(r.name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-medium text-foreground">
              {r.name}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {humanize(r.relationship)}
            </span>
          </div>
          {r.isPrimary ? (
            <StatusBadge tone="info" dot>
              Primary
            </StatusBadge>
          ) : null}
          <ChevronRight
            aria-hidden
            className="size-4 shrink-0 text-muted-foreground"
          />
        </button>
      ))}
    </div>
  );
}
