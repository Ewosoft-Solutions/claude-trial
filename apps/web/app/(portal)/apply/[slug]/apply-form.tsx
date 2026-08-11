'use client';

/**
 * Public apply form — the branded, self-service version of the internal New
 * Application form. Same structured cascade + guardians + published form, but
 * submits to the public API and, on success, shows a confirmation with a
 * reference and a copyable status-portal link (no account needed).
 */
import * as React from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { CheckCircle2, Copy, Plus, Trash2 } from 'lucide-react';

import { Button } from '@workspace/ui/components/button';
import { Label } from '@workspace/ui/components/label';
import { Input } from '@workspace/ui/components/input';
import { Textarea } from '@workspace/ui/components/textarea';
import { Checkbox } from '@workspace/ui/components/checkbox';
import { Separator } from '@workspace/ui/components/separator';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select';

import {
  GENDERS,
  GUARDIAN_RELATIONSHIPS,
  errorMessage,
  titleCase,
  type FormFieldDef,
  type Guardian,
  type Intake,
} from '../../portal-types';

const NONE = '__none__';

function emptyGuardian(isPrimary: boolean): Guardian {
  return {
    fullName: '',
    relationship: isPrimary ? 'mother' : 'father',
    email: '',
    address: '',
    phoneCountryCode: '+234',
    phoneNumber: '',
    whatsappSameAsPhone: true,
    whatsappCountryCode: '+234',
    whatsappNumber: '',
    isPrimary,
  };
}

export function ApplyForm({ slug, intake }: { slug: string; intake: Intake }) {
  const { school, structure, form } = intake;
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState<{
    reference: string;
    statusToken: string;
  } | null>(null);

  const [name, setName] = React.useState('');
  const [dob, setDob] = React.useState('');
  const [gender, setGender] = React.useState('');
  const [stateOfOrigin, setStateOfOrigin] = React.useState('');
  const [religion, setReligion] = React.useState('');
  const [healthNotes, setHealthNotes] = React.useState('');

  const multiCampus = structure.campuses.length > 1;
  const [campusId, setCampusId] = React.useState('');
  const [stageId, setStageId] = React.useState('');
  const [yearLevelId, setYearLevelId] = React.useState('');
  const [streamId, setStreamId] = React.useState('');

  const [guardians, setGuardians] = React.useState<Guardian[]>([
    emptyGuardian(true),
  ]);
  const [answers, setAnswers] = React.useState<Record<string, unknown>>({});

  const yearLevels = React.useMemo(
    () => structure.yearLevels.filter((y) => !stageId || y.stageId === stageId),
    [structure.yearLevels, stageId],
  );

  function setGuardian(i: number, patch: Partial<Guardian>) {
    setGuardians((prev) =>
      prev.map((g, idx) => (idx === i ? { ...g, ...patch } : g)),
    );
  }

  const primary = guardians[0];
  const canSubmit =
    !!name.trim() &&
    !!yearLevelId &&
    !!primary?.fullName.trim() &&
    !!primary?.phoneNumber.trim();

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    try {
      const payload = {
        applicantName: name.trim(),
        yearLevelId,
        stageId: stageId || undefined,
        streamId: streamId || undefined,
        campusId: campusId || undefined,
        dateOfBirth: dob || undefined,
        gender: gender || undefined,
        stateOfOrigin: stateOfOrigin.trim() || undefined,
        religion: religion.trim() || undefined,
        healthNotes: healthNotes.trim() || undefined,
        guardians: guardians.map((g, i) => ({
          fullName: g.fullName.trim(),
          relationship: g.relationship,
          email: g.email.trim() || undefined,
          address: g.address.trim() || undefined,
          phoneCountryCode: g.phoneCountryCode.trim() || '+234',
          phoneNumber: g.phoneNumber.trim(),
          whatsappSameAsPhone: g.whatsappSameAsPhone,
          whatsappCountryCode: g.whatsappSameAsPhone
            ? undefined
            : g.whatsappCountryCode.trim() || '+234',
          whatsappNumber: g.whatsappSameAsPhone
            ? undefined
            : g.whatsappNumber.trim() || undefined,
          isPrimary: i === 0,
        })),
        formAnswers: form ? answers : undefined,
      };
      const res = await fetch(
        `/api/public/admissions/schools/${encodeURIComponent(slug)}/apply`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
      if (!res.ok) {
        toast.error(
          await errorMessage(res, 'Could not submit your application'),
        );
        return;
      }
      const data = (await res.json()) as {
        reference: string;
        statusToken: string;
      };
      setDone({ reference: data.reference, statusToken: data.statusToken });
    } catch {
      toast.error('Network error — please try again.');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    const statusPath = `/status/${done.statusToken}`;
    const statusUrl =
      typeof window !== 'undefined'
        ? `${window.location.origin}${statusPath}`
        : statusPath;
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
          <CheckCircle2 className="size-12 text-success" aria-hidden />
          <div>
            <h1 className="text-xl font-semibold">Application received</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Thank you for applying to {school.name}. Save your tracking link
              to check progress and upload any documents.
            </p>
          </div>
          <div className="w-full rounded-lg border border-border bg-muted/40 p-3 text-sm">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Reference
            </div>
            <div className="font-mono">{done.reference}</div>
          </div>
          <div className="flex w-full flex-col gap-2 sm:flex-row">
            <Button asChild className="flex-1">
              <Link href={statusPath}>Track my application</Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => {
                void navigator.clipboard?.writeText(statusUrl);
                toast.success('Tracking link copied');
              }}
            >
              <Copy className="mr-1 size-4" aria-hidden /> Copy link
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-primary">
          Admissions
        </span>
        <h1 className="text-2xl font-semibold">Apply to {school.name}</h1>
        <p className="text-sm text-muted-foreground">
          Fill in the applicant and guardian details below. You&apos;ll get a
          reference and a link to track progress.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Applicant</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ap-name">Child&apos;s full name *</Label>
            <Input
              id="ap-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Ada Okoro"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ap-dob">Date of birth</Label>
              <Input
                id="ap-dob"
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Gender</Label>
              <Select value={gender} onValueChange={setGender}>
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {GENDERS.map((g) => (
                    <SelectItem key={g} value={g} className="capitalize">
                      {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ap-state">State of origin</Label>
              <Input
                id="ap-state"
                value={stateOfOrigin}
                onChange={(e) => setStateOfOrigin(e.target.value)}
                placeholder="e.g. Anambra"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ap-religion">Religion</Label>
              <Input
                id="ap-religion"
                value={religion}
                onChange={(e) => setReligion(e.target.value)}
                placeholder="optional"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ap-health">Health notes</Label>
            <Textarea
              id="ap-health"
              value={healthNotes}
              onChange={(e) => setHealthNotes(e.target.value)}
              placeholder="Allergies, conditions, medication… (optional)"
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Applying for *</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {multiCampus && (
            <div className="flex flex-col gap-1.5">
              <Label>Campus</Label>
              <Select value={campusId} onValueChange={setCampusId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select campus" />
                </SelectTrigger>
                <SelectContent>
                  {structure.campuses.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label>Level</Label>
            <Select
              value={stageId}
              onValueChange={(v) => {
                setStageId(v);
                setYearLevelId('');
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select level" />
              </SelectTrigger>
              <SelectContent>
                {structure.stages.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Class</Label>
            <Select
              value={yearLevelId}
              onValueChange={setYearLevelId}
              disabled={yearLevels.length === 0}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    stageId ? 'Select class' : 'Select a level first'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {yearLevels.map((y) => (
                  <SelectItem key={y.id} value={y.id}>
                    {y.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {structure.streams.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <Label>Department</Label>
              <Select
                value={streamId || NONE}
                onValueChange={(v) => setStreamId(v === NONE ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Not applicable" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Not applicable</SelectItem>
                  {structure.streams.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Parents / guardians</CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setGuardians((p) => [...p, emptyGuardian(false)])}
          >
            <Plus className="mr-1 size-3.5" aria-hidden /> Add
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {guardians.map((g, i) => (
            <div
              key={i}
              className="flex flex-col gap-3 rounded-lg border border-border p-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  {i === 0 ? 'Primary contact *' : `Guardian ${i + 1}`}
                </span>
                {i > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      setGuardians((p) => p.filter((_, idx) => idx !== i))
                    }
                    className="text-muted-foreground hover:text-destructive"
                    aria-label="Remove guardian"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label>Full name</Label>
                  <Input
                    value={g.fullName}
                    onChange={(e) =>
                      setGuardian(i, { fullName: e.target.value })
                    }
                    placeholder="e.g. Mrs Ebele Okoro"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Relationship</Label>
                  <Select
                    value={g.relationship}
                    onValueChange={(v) => setGuardian(i, { relationship: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {GUARDIAN_RELATIONSHIPS.map((r) => (
                        <SelectItem key={r} value={r} className="capitalize">
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Phone {i === 0 ? '*' : ''}</Label>
                <div className="flex gap-2">
                  <Input
                    value={g.phoneCountryCode}
                    onChange={(e) =>
                      setGuardian(i, { phoneCountryCode: e.target.value })
                    }
                    className="w-20"
                    aria-label="Country code"
                  />
                  <Input
                    value={g.phoneNumber}
                    onChange={(e) =>
                      setGuardian(i, { phoneNumber: e.target.value })
                    }
                    className="flex-1"
                    placeholder="801 234 5678"
                    inputMode="tel"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={g.whatsappSameAsPhone}
                  onCheckedChange={(v) =>
                    setGuardian(i, { whatsappSameAsPhone: v === true })
                  }
                />
                WhatsApp is the same as this phone number
              </label>
              <div className="flex flex-col gap-1.5">
                <Label>Email</Label>
                <Input
                  value={g.email}
                  onChange={(e) => setGuardian(i, { email: e.target.value })}
                  placeholder="optional"
                  inputMode="email"
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {form && form.fields.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{form.title}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {form.fields.map((field) => (
              <PortalField
                key={field.key}
                field={field}
                value={answers[field.key]}
                onChange={(v) => setAnswers((a) => ({ ...a, [field.key]: v }))}
              />
            ))}
          </CardContent>
        </Card>
      )}

      <Separator />

      <Button
        type="button"
        size="lg"
        onClick={() => void submit()}
        disabled={busy || !canSubmit}
      >
        {busy ? 'Submitting…' : 'Submit application'}
      </Button>
    </div>
  );
}

function PortalField({
  field,
  value,
  onChange,
}: {
  field: FormFieldDef;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const id = `pf-${field.key}`;
  const label = (
    <Label htmlFor={id}>
      {field.label}
      {field.required && <span className="ml-1 text-destructive">*</span>}
    </Label>
  );

  if (field.type === 'boolean') {
    return (
      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={value === true}
          onCheckedChange={(c) => onChange(c === true)}
        />
        {field.label}
      </label>
    );
  }
  if (field.type === 'paragraph') {
    return (
      <div className="flex flex-col gap-1.5">
        {label}
        <Textarea
          id={id}
          value={(value as string) ?? ''}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    );
  }
  if (field.type === 'select') {
    return (
      <div className="flex flex-col gap-1.5">
        {label}
        <Select
          value={(value as string) ?? ''}
          onValueChange={(v) => onChange(v)}
        >
          <SelectTrigger id={id}>
            <SelectValue placeholder="Choose…" />
          </SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map((opt) => (
              <SelectItem key={opt} value={opt}>
                {titleCase(opt)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }
  if (field.type === 'multiselect') {
    const selected = Array.isArray(value) ? (value as string[]) : [];
    return (
      <div className="flex flex-col gap-1.5">
        {label}
        <div className="flex flex-col gap-1.5">
          {(field.options ?? []).map((opt) => (
            <label key={opt} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={selected.includes(opt)}
                onCheckedChange={() =>
                  onChange(
                    selected.includes(opt)
                      ? selected.filter((o) => o !== opt)
                      : [...selected, opt],
                  )
                }
              />
              {opt}
            </label>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1.5">
      {label}
      <Input
        id={id}
        type={
          field.type === 'number'
            ? 'number'
            : field.type === 'date'
              ? 'date'
              : 'text'
        }
        value={value === undefined || value === null ? '' : String(value)}
        placeholder={field.placeholder}
        onChange={(e) =>
          onChange(
            field.type === 'number'
              ? e.target.value === ''
                ? ''
                : Number(e.target.value)
              : e.target.value,
          )
        }
      />
    </div>
  );
}
