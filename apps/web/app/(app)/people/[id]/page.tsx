import Link from 'next/link';
import {
  ArrowLeft,
  Briefcase,
  ExternalLink,
  Lock,
  Mail,
  Phone,
} from 'lucide-react';

import { serverApiGet } from '@/lib/server-api';
import { Avatar, AvatarFallback } from '@workspace/ui/components/avatar';
import { Button } from '@workspace/ui/components/button';
import { StatusBadge } from '@workspace/ui/custom/data-display/status-badge';
import { ShellMain } from '@workspace/ui/custom/shell/app-shell';
import { PermissionDeniedState } from '@workspace/ui/custom/states/page-states';

import { parseType } from '../people-config';
import type {
  PersonDetail,
  PersonDetailRelation,
} from '../person-detail-drawer';

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

function humanize(value: string): string {
  const s = value.replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const PROFILE_LABEL: Record<string, string> = {
  student: 'Student',
  guardian: 'Guardian',
  staff: 'Staff',
  user: 'User',
};

export default async function PersonProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string }>;
}) {
  const { id } = await params;
  const { type: rawType } = await searchParams;
  const type = parseType(rawType);

  const detail = await serverApiGet<PersonDetail>(
    `/directory/people/${encodeURIComponent(id)}?type=${type}`,
  );

  if (!detail) {
    return (
      <ShellMain>
        <BackLink />
        <PermissionDeniedState
          title="Person not available"
          description="This person doesn't exist, or your role doesn't allow viewing them."
        />
      </ShellMain>
    );
  }

  return (
    <ShellMain>
      <BackLink />

      <div className="flex flex-col gap-5">
        <header className="flex flex-wrap items-center gap-4">
          <Avatar className="size-14">
            <AvatarFallback
              seed={detail.name}
              className="text-lg font-semibold"
            >
              {initials(detail.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h1 className="font-display text-[26px] font-bold leading-tight text-foreground">
              {detail.name}
            </h1>
            <p className="text-sm text-muted-foreground">
              {detail.profiles.length > 0
                ? detail.profiles.map((p) => PROFILE_LABEL[p] ?? p).join(' · ')
                : detail.type === 'prospect'
                  ? 'Prospect'
                  : 'No roles yet'}
            </p>
          </div>
        </header>

        <div className="grid gap-4 @2xl/main:grid-cols-2">
          {(detail.email || detail.phone) && (
            <Card title="Contact">
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
            </Card>
          )}

          {detail.student ? (
            <Card title="Student">
              <Field label="Student no." value={detail.student.studentNumber} />
              <Field label="Grade" value={detail.student.gradeLevel} />
              <Field
                label="Enrollment"
                value={
                  detail.student.enrollmentStatus
                    ? humanize(detail.student.enrollmentStatus)
                    : null
                }
              />
              {detail.student.guardians.length > 0 ? (
                <Relations
                  label="Guardians"
                  relations={detail.student.guardians}
                />
              ) : null}
            </Card>
          ) : null}

          {detail.staff && detail.staff.length > 0 ? (
            <Card title="Staff">
              {detail.staff.map((s, i) => (
                <div
                  key={s.employeeNumber ?? i}
                  className="flex flex-col gap-1.5 rounded-md border border-border p-2.5"
                >
                  <div className="flex items-center gap-2 font-medium text-foreground">
                    <Briefcase className="size-4 text-muted-foreground" />
                    {s.jobTitle ?? s.employeeNumber ?? 'Staff'}
                  </div>
                  <Field label="Department" value={s.department} />
                  <Field
                    label="Employment"
                    value={humanize(s.employmentStatus)}
                  />
                </div>
              ))}
            </Card>
          ) : null}

          {detail.wards && detail.wards.length > 0 ? (
            <Card title="Wards">
              <Relations label="Guardian of" relations={detail.wards} />
            </Card>
          ) : null}

          {detail.account ? (
            <Card title="Account">
              <Field label="Status" value={humanize(detail.account.status)} />
              <Field label="Login email" value={detail.account.email} />
            </Card>
          ) : null}

          {detail.prospect ? (
            <Card title="Application">
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
            </Card>
          ) : null}
        </div>
      </div>
    </ShellMain>
  );
}

function BackLink() {
  return (
    <Button asChild variant="ghost" size="sm" className="w-fit">
      <Link href="/people">
        <ArrowLeft aria-hidden /> Back to People
      </Link>
    </Button>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2 rounded-[var(--radius)] border border-border bg-card p-4 shadow-xs">
      <h2 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">
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
    <div className="flex items-center gap-2 text-sm">
      <span className="shrink-0 text-muted-foreground">{icon}</span>
      {masked ? (
        <span
          className="inline-flex items-center gap-1 text-muted-foreground"
          title="Hidden — you don't have permission to view this contact detail"
        >
          <Lock aria-hidden className="size-3" />
          {value}
        </span>
      ) : (
        <a href={href} className="truncate text-foreground hover:underline">
          {value}
        </a>
      )}
    </div>
  );
}

function Relations({
  label,
  relations,
}: {
  label: string;
  relations: PersonDetailRelation[];
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      {relations.map((r) => (
        <Link
          key={r.id}
          href={`/people/${r.id}`}
          className="flex items-center justify-between gap-2 rounded-md border border-border p-2 text-sm transition-colors hover:border-ring/60 hover:bg-accent/40"
        >
          <span className="truncate font-medium text-foreground">{r.name}</span>
          <span className="flex shrink-0 items-center gap-1.5">
            <span className="text-xs text-muted-foreground">
              {humanize(r.relationship)}
            </span>
            {r.isPrimary ? (
              <StatusBadge tone="info" dot>
                Primary
              </StatusBadge>
            ) : null}
            <ExternalLink
              aria-hidden
              className="size-3.5 text-muted-foreground"
            />
          </span>
        </Link>
      ))}
    </div>
  );
}
