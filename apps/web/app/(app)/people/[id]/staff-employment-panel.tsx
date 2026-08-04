'use client';

/**
 * WB1-2 · First-class staff employment on the person detail.
 *
 * Renders a person's employment record(s) — position, department, type, status,
 * reporting line, direct-report count, and qualifications — and the management
 * actions gated on the staff.* permissions: open an employment (independent of
 * any payroll run), edit it, disable (end) it, and add/remove qualifications.
 * Server-side permission checks are authoritative; the `perms` flags only decide
 * what renders.
 */
import * as React from 'react';
import { toast } from 'sonner';
import { Briefcase, GraduationCap, Plus, Trash2 } from 'lucide-react';

import { Button } from '@workspace/ui/components/button';
import { Input } from '@workspace/ui/components/input';
import { Label } from '@workspace/ui/components/label';
import { Textarea } from '@workspace/ui/components/textarea';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@workspace/ui/components/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select';
import { StatusBadge } from '@workspace/ui/custom/data-display/status-badge';
import type { StateTone } from '@workspace/ui/types/states.types';

import { Section, DetailGrid, Field } from '../person-detail-ui';
import { formatDate } from '../person-detail.types';

interface Qualification {
  id: string;
  title: string;
  qualificationType: string | null;
  institution: string | null;
  fieldOfStudy: string | null;
  awardedYear: number | null;
  documentId: string | null;
}

interface Employment {
  id: string;
  employeeNumber: string | null;
  jobTitle: string | null;
  department: string | null;
  employmentType: string | null;
  employmentStatus: string;
  hireDate: string | null;
  endDate: string | null;
  endReason: string | null;
  sourceSystem: string | null;
  reportsTo: { id: string; name: string; jobTitle: string | null } | null;
  directReportCount: number;
  qualifications: Qualification[];
}

interface Manager {
  id: string;
  name: string;
  jobTitle: string | null;
  department: string | null;
}

export interface EmploymentPerms {
  create: boolean;
  edit: boolean;
  delete: boolean;
}

const STATUS_TONE: Record<string, StateTone> = {
  active: 'success',
  on_leave: 'warning',
  suspended: 'warning',
  terminated: 'neutral',
};

const EMPLOYMENT_TYPES = [
  'full_time',
  'part_time',
  'contract',
  'volunteer',
] as const;

const SETTABLE_STATUS = ['active', 'on_leave', 'suspended'] as const;

const QUALIFICATION_TYPES = [
  'degree',
  'diploma',
  'certificate',
  'license',
  'other',
] as const;

function labelize(value: string | null): string {
  if (!value) return '—';
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function StaffEmploymentPanel({
  personId,
  perms,
}: {
  personId: string;
  perms: EmploymentPerms;
}) {
  const [rows, setRows] = React.useState<Employment[] | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const base = `/api/directory/people/${personId}/employment`;

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(base, { cache: 'no-store' });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { data?: Employment[] };
      setRows(data.data ?? []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [base]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const request = React.useCallback(
    async (
      path: string,
      method: 'POST' | 'PATCH' | 'DELETE',
      body: unknown,
      successMsg: string,
    ) => {
      setBusy(true);
      try {
        const res = await fetch(path, {
          method,
          headers: { 'content-type': 'application/json' },
          body: body === undefined ? undefined : JSON.stringify(body),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as {
            message?: string;
          } | null;
          throw new Error(data?.message ?? `Request failed (${res.status})`);
        }
        toast.success(successMsg);
        await load();
        return true;
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Something went wrong');
        return false;
      } finally {
        setBusy(false);
      }
    },
    [load],
  );

  return (
    <Section
      title="Staff employment"
      action={
        perms.create && rows ? (
          <EmploymentDialog
            base={base}
            busy={busy}
            request={request}
            trigger={
              <Button size="sm" variant="outline" disabled={busy}>
                <Plus aria-hidden /> Add employment
              </Button>
            }
          />
        ) : undefined
      }
    >
      {loading ? (
        <div
          className="h-24 animate-pulse rounded-lg border border-border bg-card/40"
          aria-hidden
        />
      ) : error ? (
        <div className="rounded-lg border border-border bg-card/40 p-4 text-sm">
          <p className="text-muted-foreground">
            Could not load employment records.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => void load()}
          >
            Retry
          </Button>
        </div>
      ) : rows && rows.length > 0 ? (
        <div className="flex flex-col gap-3">
          {rows.map((row) => (
            <EmploymentCard
              key={row.id}
              base={base}
              row={row}
              perms={perms}
              busy={busy}
              request={request}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-card/40 p-4">
          <p className="text-sm text-muted-foreground">
            No employment record yet — this person is not managed as staff.
          </p>
          {!perms.create ? (
            <p className="text-xs text-muted-foreground">
              You do not have permission to create employment records.
            </p>
          ) : null}
        </div>
      )}
    </Section>
  );
}

function EmploymentCard({
  base,
  row,
  perms,
  busy,
  request,
}: {
  base: string;
  row: Employment;
  perms: EmploymentPerms;
  busy: boolean;
  request: (
    p: string,
    m: 'POST' | 'PATCH' | 'DELETE',
    b: unknown,
    msg: string,
  ) => Promise<boolean>;
}) {
  const ended = row.employmentStatus === 'terminated';
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-card/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-medium text-foreground">
          <Briefcase className="size-4 text-muted-foreground" aria-hidden />
          {row.jobTitle ?? 'Staff'}
        </div>
        <StatusBadge tone={STATUS_TONE[row.employmentStatus] ?? 'neutral'} dot>
          {labelize(row.employmentStatus)}
        </StatusBadge>
      </div>

      <DetailGrid>
        <Field label="Department" value={row.department} />
        <Field label="Employment type" value={labelize(row.employmentType)} />
        <Field label="Employee number" value={row.employeeNumber} />
        <Field label="Hired" value={formatDate(row.hireDate)} />
        <Field label="Reports to" value={row.reportsTo?.name ?? null} />
        <Field
          label="Direct reports"
          value={
            row.directReportCount > 0 ? String(row.directReportCount) : null
          }
        />
        {ended ? (
          <>
            <Field label="Ended" value={formatDate(row.endDate)} />
            <Field label="End reason" value={row.endReason} />
          </>
        ) : null}
      </DetailGrid>

      {row.qualifications.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium text-muted-foreground">
            Qualifications
          </p>
          <ul className="flex flex-col gap-1">
            {row.qualifications.map((q) => (
              <li
                key={q.id}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <GraduationCap
                    className="size-3.5 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                  <span className="truncate">
                    {q.title}
                    {q.institution ? (
                      <span className="text-muted-foreground">
                        {' '}
                        — {q.institution}
                      </span>
                    ) : null}
                    {q.awardedYear ? (
                      <span className="text-muted-foreground">
                        {' '}
                        ({q.awardedYear})
                      </span>
                    ) : null}
                  </span>
                </span>
                {perms.delete ? (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove ${q.title}`}
                    disabled={busy}
                    onClick={() =>
                      void request(
                        `${base}/${row.id}/qualifications/${q.id}`,
                        'DELETE',
                        undefined,
                        'Qualification removed',
                      )
                    }
                  >
                    <Trash2 aria-hidden />
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {perms.edit ? (
        <div className="flex flex-wrap gap-2">
          <EmploymentDialog
            base={base}
            busy={busy}
            request={request}
            existing={row}
            trigger={
              <Button variant="outline" size="sm" disabled={busy}>
                Edit
              </Button>
            }
          />
          <QualificationDialog
            base={base}
            employmentId={row.id}
            busy={busy}
            request={request}
          />
          {!ended ? (
            <DisableDialog
              base={base}
              employmentId={row.id}
              busy={busy}
              request={request}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Create or edit an employment. `existing` switches it to edit mode. */
function EmploymentDialog({
  base,
  busy,
  request,
  existing,
  trigger,
}: {
  base: string;
  busy: boolean;
  request: (
    p: string,
    m: 'POST' | 'PATCH' | 'DELETE',
    b: unknown,
    msg: string,
  ) => Promise<boolean>;
  existing?: Employment;
  trigger: React.ReactNode;
}) {
  const isEdit = !!existing;
  const [open, setOpen] = React.useState(false);
  const [jobTitle, setJobTitle] = React.useState(existing?.jobTitle ?? '');
  const [department, setDepartment] = React.useState(
    existing?.department ?? '',
  );
  const [employmentType, setEmploymentType] = React.useState(
    existing?.employmentType ?? '',
  );
  const [employeeNumber, setEmployeeNumber] = React.useState(
    existing?.employeeNumber ?? '',
  );
  const [hireDate, setHireDate] = React.useState(
    existing?.hireDate ? existing.hireDate.slice(0, 10) : '',
  );
  const [status, setStatus] = React.useState(
    existing && SETTABLE_STATUS.includes(existing.employmentStatus as never)
      ? existing.employmentStatus
      : 'active',
  );
  const [reportsTo, setReportsTo] = React.useState(
    existing?.reportsTo?.id ?? '',
  );
  const [managers, setManagers] = React.useState<Manager[] | null>(null);

  React.useEffect(() => {
    if (!open || managers) return;
    void (async () => {
      try {
        const suffix = existing ? `?exclude=${existing.id}` : '';
        const res = await fetch(`${base}/managers${suffix}`, {
          cache: 'no-store',
        });
        const data = (await res.json()) as { data?: Manager[] };
        setManagers(data.data ?? []);
      } catch {
        setManagers([]);
      }
    })();
  }, [open, managers, base, existing]);

  const NONE = '__none__';

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Edit employment' : 'Add employment'}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update this employment record.'
              : 'Open a first-class employment record — no payroll run required.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="emp-title">Job title / position</Label>
            <Input
              id="emp-title"
              value={jobTitle}
              maxLength={120}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="e.g. Bursar"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="emp-dept">Department</Label>
            <Input
              id="emp-dept"
              value={department}
              maxLength={120}
              onChange={(e) => setDepartment(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="emp-number">Employee number</Label>
            <Input
              id="emp-number"
              value={employeeNumber}
              maxLength={60}
              onChange={(e) => setEmployeeNumber(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="emp-type">Employment type</Label>
            <Select value={employmentType} onValueChange={setEmploymentType}>
              <SelectTrigger id="emp-type">
                <SelectValue placeholder="Choose a type" />
              </SelectTrigger>
              <SelectContent>
                {EMPLOYMENT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {labelize(t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="emp-hire">Hire date</Label>
            <Input
              id="emp-hire"
              type="date"
              value={hireDate}
              onChange={(e) => setHireDate(e.target.value)}
            />
          </div>
          {isEdit ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="emp-status">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="emp-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SETTABLE_STATUS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {labelize(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="emp-manager">Reports to</Label>
            <Select
              value={reportsTo || NONE}
              onValueChange={(v) => setReportsTo(v === NONE ? '' : v)}
            >
              <SelectTrigger id="emp-manager">
                <SelectValue
                  placeholder={managers ? 'No manager' : 'Loading staff…'}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>No manager</SelectItem>
                {(managers ?? []).map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                    {m.jobTitle ? ` — ${m.jobTitle}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" size="sm">
              Cancel
            </Button>
          </DialogClose>
          <Button
            size="sm"
            disabled={busy}
            onClick={async () => {
              const payload = {
                jobTitle: jobTitle.trim() || undefined,
                department: department.trim() || undefined,
                employmentType: employmentType || undefined,
                employeeNumber: employeeNumber.trim() || undefined,
                hireDate: hireDate || undefined,
                ...(isEdit
                  ? {
                      employmentStatus: status,
                      reportsToStaffProfileId: reportsTo || null,
                    }
                  : reportsTo
                    ? { reportsToStaffProfileId: reportsTo }
                    : {}),
              };
              const ok = await request(
                isEdit ? `${base}/${existing!.id}` : base,
                isEdit ? 'PATCH' : 'POST',
                payload,
                isEdit ? 'Employment updated' : 'Employment created',
              );
              if (ok) setOpen(false);
            }}
          >
            {isEdit ? 'Save changes' : 'Create employment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DisableDialog({
  base,
  employmentId,
  busy,
  request,
}: {
  base: string;
  employmentId: string;
  busy: boolean;
  request: (
    p: string,
    m: 'POST' | 'PATCH' | 'DELETE',
    b: unknown,
    msg: string,
  ) => Promise<boolean>;
}) {
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState('');
  const [endDate, setEndDate] = React.useState('');

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant="destructive"
        size="sm"
        disabled={busy}
        onClick={() => setOpen(true)}
      >
        Disable
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>End this employment?</DialogTitle>
          <DialogDescription>
            The employment is marked terminated with an end date. This does not
            touch payroll and is audited.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="disable-date">
              End date{' '}
              <span className="text-muted-foreground">(defaults to today)</span>
            </Label>
            <Input
              id="disable-date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="disable-reason">
              Reason <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="disable-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Resigned"
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" size="sm">
              Cancel
            </Button>
          </DialogClose>
          <Button
            variant="destructive"
            size="sm"
            disabled={busy}
            onClick={async () => {
              const ok = await request(
                `${base}/${employmentId}/disable`,
                'POST',
                {
                  reason: reason.trim() || undefined,
                  endDate: endDate || undefined,
                },
                'Employment ended',
              );
              if (ok) setOpen(false);
            }}
          >
            End employment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function QualificationDialog({
  base,
  employmentId,
  busy,
  request,
}: {
  base: string;
  employmentId: string;
  busy: boolean;
  request: (
    p: string,
    m: 'POST' | 'PATCH' | 'DELETE',
    b: unknown,
    msg: string,
  ) => Promise<boolean>;
}) {
  const [open, setOpen] = React.useState(false);
  const [title, setTitle] = React.useState('');
  const [qualificationType, setType] = React.useState('');
  const [institution, setInstitution] = React.useState('');
  const [awardedYear, setYear] = React.useState('');

  const yearNum = awardedYear.trim() ? Number(awardedYear) : undefined;
  const yearErr =
    yearNum !== undefined &&
    (!Number.isInteger(yearNum) || yearNum < 1900 || yearNum > 2100)
      ? 'Enter a year between 1900 and 2100'
      : null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => setOpen(true)}
      >
        <GraduationCap aria-hidden /> Add qualification
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a qualification</DialogTitle>
          <DialogDescription>
            Record an academic or professional qualification for this
            employment.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="qual-title">Title</Label>
            <Input
              id="qual-title"
              value={title}
              maxLength={160}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. B.Sc Mathematics"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="qual-type">Type</Label>
            <Select value={qualificationType} onValueChange={setType}>
              <SelectTrigger id="qual-type">
                <SelectValue placeholder="Choose a type" />
              </SelectTrigger>
              <SelectContent>
                {QUALIFICATION_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {labelize(t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="qual-year">Year awarded</Label>
            <Input
              id="qual-year"
              inputMode="numeric"
              value={awardedYear}
              onChange={(e) => setYear(e.target.value)}
              aria-invalid={yearErr ? true : undefined}
              aria-describedby={yearErr ? 'qual-year-err' : undefined}
            />
            {yearErr ? (
              <p id="qual-year-err" className="text-xs text-destructive">
                {yearErr}
              </p>
            ) : null}
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="qual-inst">Institution</Label>
            <Input
              id="qual-inst"
              value={institution}
              maxLength={160}
              onChange={(e) => setInstitution(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" size="sm">
              Cancel
            </Button>
          </DialogClose>
          <Button
            size="sm"
            disabled={busy || !title.trim() || !!yearErr}
            onClick={async () => {
              const ok = await request(
                `${base}/${employmentId}/qualifications`,
                'POST',
                {
                  title: title.trim(),
                  qualificationType: qualificationType || undefined,
                  institution: institution.trim() || undefined,
                  awardedYear: yearNum,
                },
                'Qualification added',
              );
              if (ok) {
                setTitle('');
                setType('');
                setInstitution('');
                setYear('');
                setOpen(false);
              }
            }}
          >
            Add qualification
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
