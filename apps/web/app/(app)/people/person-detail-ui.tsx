/**
 * Shared presentational pieces for the person detail drawer + profile tabs.
 * Pure (no hooks) so both the client drawer and the server profile pages can
 * use them — interactive rows take either an `href` (Link) or an `onSelect`.
 *
 * Hierarchy fix: a `Section` title is bold/foreground with a hairline divider;
 * a `Field` label is small + muted. The two never read as the same level.
 */
import * as React from 'react';
import Link from 'next/link';
import {
  Briefcase,
  ChevronRight,
  GraduationCap,
  Lock,
  Mail,
  Phone,
  UserCog,
  Users,
} from 'lucide-react';

import { cn } from '@workspace/ui/lib/utils';
import { Avatar, AvatarFallback } from '@workspace/ui/components/avatar';
import { StatusBadge } from '@workspace/ui/custom/data-display/status-badge';
import type { StateTone } from '@workspace/ui/types/states.types';

import {
  ageFrom,
  formatDate,
  formatMinor,
  guardianRoleLabel,
  humanize,
  initials,
  profileLabel,
  wardRoleLabel,
  type PersonContactPoint,
  type PersonContactPreference,
  type PersonDetail,
  type PersonFlags,
  type PersonRelation,
  type PersonTimelineStep,
  type ProfileKind,
} from './person-detail.types';

const PROFILE_ICON: Record<ProfileKind, React.ReactNode> = {
  student: <GraduationCap className="size-3" />,
  guardian: <Users className="size-3" />,
  staff: <Briefcase className="size-3" />,
  user: <UserCog className="size-3" />,
};

/* ---- Layout primitives -------------------------------------------------- */

export function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2 border-b border-border pb-1.5">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

export function DetailGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-x-4 gap-y-3.5">{children}</div>;
}

export function Field({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="break-words text-sm text-foreground">
        {value ?? <span className="text-muted-foreground">—</span>}
      </span>
    </div>
  );
}

/* ---- Header ------------------------------------------------------------- */

export function ProfileChips({ profiles }: { profiles: ProfileKind[] }) {
  if (profiles.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {profiles.map((p) => (
        <span
          key={p}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
        >
          <span aria-hidden>{PROFILE_ICON[p]}</span>
          {profileLabel(p)}
        </span>
      ))}
    </div>
  );
}

const FLAG_META: Record<keyof PersonFlags, { label: string; tone: StateTone }> =
  {
    siblingEnrolled: { label: 'Sibling enrolled', tone: 'info' },
    hasSiblings: { label: 'Has siblings', tone: 'info' },
    newAdmission: { label: 'New admission', tone: 'info' },
    feesOverdue: { label: 'Fees overdue', tone: 'destructive' },
    attendanceRisk: { label: 'Attendance risk', tone: 'warning' },
    onLeave: { label: 'On leave', tone: 'warning' },
  };

/** At-a-glance signal chips (the "sibling enrolled" idea, generalised). */
export function FlagChips({ flags }: { flags: PersonFlags }) {
  const active = (Object.keys(FLAG_META) as (keyof PersonFlags)[]).filter(
    (k) => flags[k],
  );
  if (active.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {active.map((k) => (
        <StatusBadge key={k} tone={FLAG_META[k].tone} dot>
          {FLAG_META[k].label}
        </StatusBadge>
      ))}
    </div>
  );
}

/* ---- Contact ------------------------------------------------------------ */

export function ContactList({
  detail,
}: {
  detail: Pick<
    PersonDetail,
    'contactPoints' | 'email' | 'phone' | 'contactMasked' | 'contactPreferences'
  >;
}) {
  const points: PersonContactPoint[] =
    detail.contactPoints.length > 0
      ? detail.contactPoints
      : [
          ...(detail.email
            ? [
                {
                  kind: 'email',
                  value: detail.email,
                  label: null,
                  isPrimary: true,
                  verified: false,
                },
              ]
            : []),
          ...(detail.phone
            ? [
                {
                  kind: 'phone',
                  value: detail.phone,
                  label: null,
                  isPrimary: false,
                  verified: false,
                },
              ]
            : []),
        ];
  if (points.length === 0 && detail.contactPreferences.length === 0) {
    return <p className="text-sm text-muted-foreground">No contact on file.</p>;
  }
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-card/40 p-3">
      {points.map((p, i) => (
        <ContactRow
          key={`${p.kind}-${i}`}
          point={p}
          masked={detail.contactMasked}
        />
      ))}
      {detail.contactPreferences.length > 0 ? (
        <div className="mt-1 flex flex-wrap items-center gap-1.5 border-t border-border pt-2">
          <span className="text-[11px] text-muted-foreground">Consent:</span>
          {detail.contactPreferences.map((pref: PersonContactPreference) => (
            <StatusBadge
              key={pref.channel}
              tone={
                pref.isDnd ? 'warning' : pref.optedIn ? 'success' : 'neutral'
              }
              dot
            >
              {pref.channel}
              {pref.isDnd ? ' · DND' : pref.optedIn ? '' : ' · off'}
            </StatusBadge>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ContactRow({
  point,
  masked,
}: {
  point: PersonContactPoint;
  masked: boolean;
}) {
  const Icon = point.kind === 'phone' ? Phone : Mail;
  const href =
    point.kind === 'phone' ? `tel:${point.value}` : `mailto:${point.value}`;
  return (
    <div className="flex items-center gap-2.5 text-sm">
      <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      {masked ? (
        <span
          className="inline-flex items-center gap-1 text-muted-foreground"
          title="Hidden — you don't have permission to view this contact detail"
        >
          <Lock aria-hidden className="size-3" />
          {point.value}
        </span>
      ) : (
        <a href={href} className="truncate text-foreground hover:underline">
          {point.value}
        </a>
      )}
      {point.label ? (
        <span className="text-[11px] text-muted-foreground">{point.label}</span>
      ) : null}
      {point.verified ? (
        <StatusBadge tone="success" dot>
          Verified
        </StatusBadge>
      ) : null}
    </div>
  );
}

/* ---- Identity ----------------------------------------------------------- */

export function IdentityFields({ detail }: { detail: PersonDetail }) {
  const age = ageFrom(detail.dateOfBirth);
  const address = detail.addresses[0];
  return (
    <DetailGrid>
      {detail.preferredName ? (
        <Field label="Preferred name" value={detail.preferredName} />
      ) : null}
      <Field
        label="Date of birth"
        value={
          detail.dateOfBirth
            ? `${formatDate(detail.dateOfBirth)}${age != null ? ` · ${age}y` : ''}`
            : null
        }
      />
      <Field
        label="Gender"
        value={detail.gender ? humanize(detail.gender) : null}
      />
      <Field label="Nationality" value={detail.nationality} />
      <Field label="State of origin" value={detail.stateOfOrigin} />
      <Field label="LGA" value={detail.lgaOfOrigin} />
      {address ? (
        <Field
          label="Address"
          value={[address.line1, address.city, address.subdivision]
            .filter(Boolean)
            .join(', ')}
        />
      ) : null}
    </DetailGrid>
  );
}

/* ---- Timeline ----------------------------------------------------------- */

export function LifecycleTimeline({ steps }: { steps: PersonTimelineStep[] }) {
  if (steps.length === 0) return null;
  return (
    <ol className="flex flex-col">
      {steps.map((step, i) => (
        <li key={step.key} className="flex gap-3">
          <div className="flex flex-col items-center">
            <span
              className={cn(
                'mt-0.5 size-3 shrink-0 rounded-full border-2',
                step.state === 'done' && 'border-primary bg-primary',
                step.state === 'current' && 'border-primary bg-background',
                step.state === 'pending' && 'border-border bg-background',
              )}
            />
            {i < steps.length - 1 ? (
              <span className="my-0.5 w-px flex-1 bg-border" />
            ) : null}
          </div>
          <div className="min-w-0 pb-4">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  'text-sm',
                  step.state === 'pending'
                    ? 'text-muted-foreground'
                    : 'font-medium text-foreground',
                )}
              >
                {step.label}
              </span>
              {step.detail ? (
                <StatusBadge tone="info" dot>
                  {humanize(step.detail)}
                </StatusBadge>
              ) : null}
            </div>
            {formatDate(step.date) ? (
              <span className="text-xs text-muted-foreground">
                {formatDate(step.date)}
              </span>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

/* ---- Relations ---------------------------------------------------------- */

export function RelationRow({
  relation,
  href,
  onSelect,
  labelFor,
}: {
  relation: PersonRelation;
  href?: string;
  onSelect?: (id: string) => void;
  /** Map the raw relationship to a display label (direction-aware). */
  labelFor?: (relationship: string) => string;
}) {
  const inner = (
    <>
      <Avatar className="size-8">
        <AvatarFallback
          seed={relation.name}
          className="text-[10px] font-semibold"
        >
          {initials(relation.name)}
        </AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium capitalize text-foreground">
          {relation.name}
        </span>
        <span className="truncate text-xs text-muted-foreground">
          {(labelFor ?? humanize)(relation.relationship)}
        </span>
      </div>
      {relation.isPrimary ? (
        <StatusBadge tone="info" dot>
          Primary
        </StatusBadge>
      ) : null}
      <ChevronRight
        aria-hidden
        className="size-4 shrink-0 text-muted-foreground"
      />
    </>
  );
  const className =
    'flex items-center gap-2.5 rounded-lg border border-border bg-card/40 p-2.5 text-left transition-colors hover:border-ring/60 hover:bg-accent/40';
  if (href) {
    return (
      <Link href={href} className={className}>
        {inner}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onSelect?.(relation.id)}
      className={className}
    >
      {inner}
    </button>
  );
}

export function RelationList({
  label,
  relations,
  href,
  onSelect,
  labelFor,
}: {
  label?: string;
  relations: PersonRelation[];
  href?: (id: string) => string;
  onSelect?: (id: string) => void;
  /** Direction-aware relationship label (e.g. wardRoleLabel for a wards list). */
  labelFor?: (relationship: string) => string;
}) {
  if (relations.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5">
      {label ? (
        <span className="text-xs text-muted-foreground">{label}</span>
      ) : null}
      {relations.map((r) => (
        <RelationRow
          key={r.id}
          relation={r}
          href={href ? href(r.id) : undefined}
          onSelect={onSelect}
          labelFor={labelFor}
        />
      ))}
    </div>
  );
}

/* ---- Stat tiles --------------------------------------------------------- */

export function StatTiles({
  items,
}: {
  items: {
    key: string;
    label: string;
    value: React.ReactNode;
    tone?: StateTone;
  }[];
}) {
  if (items.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-2.5 @md/tiles:grid-cols-3">
      {items.map((it) => (
        <div
          key={it.key}
          className="rounded-lg border border-border bg-card/40 p-3"
        >
          <div className="text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground">
            {it.label}
          </div>
          <div
            className={cn(
              'mt-1 text-lg font-bold tabular-nums text-foreground',
              it.tone === 'destructive' && 'text-destructive',
              it.tone === 'warning' && 'text-amber-500',
            )}
          >
            {it.value}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---- Composite: Overview + People (shared drawer/profile content) ------- */

/** Roll-up tiles → contact → identity → role fields → lifecycle.
 *  `accountSlot`, when provided, replaces the static read-only Account section
 *  (the interactive WB1-3 account panel on the full profile page).
 *  `employmentSlot` likewise replaces the static Employment section with the
 *  interactive WB1-2 staff-employment panel. */
export function PersonOverview({
  detail,
  accountSlot,
  accessSlot,
  employmentSlot,
}: {
  detail: PersonDetail;
  accountSlot?: React.ReactNode;
  /** WB1-6 · the interactive access-grants panel (scope + expiry + approvals). */
  accessSlot?: React.ReactNode;
  employmentSlot?: React.ReactNode;
}) {
  const rollups: {
    key: string;
    label: string;
    value: React.ReactNode;
    tone?: StateTone;
  }[] = [];
  if (detail.academics?.attendancePercent != null) {
    rollups.push({
      key: 'att',
      label: 'Attendance',
      value: `${detail.academics.attendancePercent}%`,
      tone: detail.academics.attendancePercent < 85 ? 'warning' : undefined,
    });
  }
  if (detail.academics?.averageGradePercent != null) {
    rollups.push({
      key: 'grade',
      label: 'Avg grade',
      value: `${detail.academics.averageGradePercent}%`,
    });
  }
  if (detail.finance) {
    rollups.push({
      key: 'bal',
      label: 'Balance',
      value: formatMinor(detail.finance.balance),
      tone: detail.finance.balance > 0 ? 'destructive' : undefined,
    });
  }

  return (
    <div className="@container/tiles flex flex-col gap-6">
      {rollups.length > 0 ? <StatTiles items={rollups} /> : null}

      <Section title="Contact">
        <ContactList detail={detail} />
      </Section>

      {detail.type !== 'prospect' ? (
        <Section title="Identity">
          <IdentityFields detail={detail} />
        </Section>
      ) : null}

      {detail.student ? (
        <Section title="Enrollment">
          <DetailGrid>
            <Field label="Student no." value={detail.student.studentNumber} />
            <Field label="Grade" value={detail.student.gradeLevel} />
            <Field
              label="Status"
              value={
                detail.student.enrollmentStatus
                  ? humanize(detail.student.enrollmentStatus)
                  : null
              }
            />
            <Field
              label="Admitted"
              value={formatDate(detail.student.admissionDate)}
            />
          </DetailGrid>
        </Section>
      ) : null}

      {employmentSlot ??
        (detail.staff && detail.staff.length > 0 ? (
          <Section title="Employment">
            <DetailGrid>
              <Field label="Role" value={detail.staff[0]?.jobTitle} />
              <Field label="Department" value={detail.staff[0]?.department} />
              <Field
                label="Status"
                value={humanize(detail.staff[0]?.employmentStatus ?? '')}
              />
              <Field
                label="Hired"
                value={formatDate(detail.staff[0]?.hireDate ?? null)}
              />
            </DetailGrid>
          </Section>
        ) : null)}

      {accountSlot ??
        (detail.account ? (
          <Section title="Account">
            <DetailGrid>
              <Field label="Status" value={humanize(detail.account.status)} />
              <Field label="Role" value={detail.account.role} />
              <Field label="Login email" value={detail.account.email} />
              <Field
                label="Last login"
                value={formatDate(detail.account.lastLoginAt)}
              />
            </DetailGrid>
          </Section>
        ) : null)}

      {accessSlot}

      {detail.prospect ? (
        <Section title="Application">
          <DetailGrid>
            <Field label="Applying for" value={detail.prospect.applyingFor} />
            <Field label="Guardian" value={detail.prospect.guardianName} />
            <Field label="Stage" value={humanize(detail.prospect.stage)} />
            <Field
              label="Decision"
              value={
                detail.prospect.decision
                  ? humanize(detail.prospect.decision)
                  : null
              }
            />
          </DetailGrid>
        </Section>
      ) : null}

      {detail.timeline.length > 0 ? (
        <Section title={detail.type === 'prospect' ? 'Admission' : 'Lifecycle'}>
          <LifecycleTimeline steps={detail.timeline} />
        </Section>
      ) : null}
    </div>
  );
}

/** Guardians + siblings + wards. `relationHref` (profile Links) OR `onSelect`
 *  (drawer buttons) drives the cross-navigation.
 *
 *  Relationship labels are direction-aware: a guardian is shown by THEIR role
 *  ("Parent"), a ward by the INVERSE ("Child") — so "Amara · Child" reads as
 *  "Amara is this person's child", never "Amara is the parent".
 *
 *  `hideGuardianships` drops the Guardians + Wards sections (keeping Siblings)
 *  when a richer guardianship panel is rendered alongside, to avoid listing the
 *  same people twice. */
export function PersonPeople({
  detail,
  relationHref,
  onSelect,
  hideGuardianships = false,
}: {
  detail: PersonDetail;
  relationHref?: (id: string) => string;
  onSelect?: (id: string) => void;
  hideGuardianships?: boolean;
}) {
  const guardians = hideGuardianships ? [] : (detail.student?.guardians ?? []);
  const siblings = detail.student?.siblings ?? [];
  const wards = hideGuardianships ? [] : (detail.wards ?? []);

  // "No related people" only when the person genuinely has none; when the
  // guardians/wards are merely hidden (shown by the guardianship panel) and
  // there are no siblings, render nothing here rather than a false empty state.
  const hasAnyRelation =
    (detail.student?.guardians?.length ?? 0) +
      (detail.student?.siblings?.length ?? 0) +
      (detail.wards?.length ?? 0) >
    0;
  if (!hasAnyRelation) {
    return (
      <p className="text-sm text-muted-foreground">
        No related people on file.
      </p>
    );
  }
  if (guardians.length + siblings.length + wards.length === 0) return null;
  return (
    <div className="flex flex-col gap-6">
      {guardians.length > 0 ? (
        <Section title="Guardians">
          <RelationList
            relations={guardians}
            href={relationHref}
            onSelect={onSelect}
            labelFor={guardianRoleLabel}
          />
        </Section>
      ) : null}
      {siblings.length > 0 ? (
        <Section title="Siblings">
          <RelationList
            relations={siblings}
            href={relationHref}
            onSelect={onSelect}
          />
        </Section>
      ) : null}
      {wards.length > 0 ? (
        <Section title="Children / dependents">
          <RelationList
            relations={wards}
            href={relationHref}
            onSelect={onSelect}
            labelFor={wardRoleLabel}
          />
        </Section>
      ) : null}
    </div>
  );
}
