'use client';

/**
 * WB3 structured-intake · New Application form.
 *
 * "Applying for" is a CASCADE over the school's own academic structure
 * (campus → level → class → department) so admissions data is clean and the
 * school keeps no separate list. Guardians are captured structurally (phone +
 * WhatsApp with a same-as-phone reuse), plus the applicant profile. On submit
 * the tenant's requirement checklist is attached server-side.
 */
import * as React from 'react';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';

import { Button } from '@workspace/ui/components/button';
import { Label } from '@workspace/ui/components/label';
import { Input } from '@workspace/ui/components/input';
import { Textarea } from '@workspace/ui/components/textarea';
import { Checkbox } from '@workspace/ui/components/checkbox';
import { Separator } from '@workspace/ui/components/separator';
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
  type Guardian,
  type IntakeStructure,
} from './admissions-types';

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

export function NewApplicationForm({
  structure,
  onCreated,
  onCancel,
}: {
  structure: IntakeStructure;
  onCreated: (id: string) => void;
  onCancel?: () => void;
}) {
  const [busy, setBusy] = React.useState(false);

  // Applicant
  const [name, setName] = React.useState('');
  const [dob, setDob] = React.useState('');
  const [gender, setGender] = React.useState('');
  const [stateOfOrigin, setStateOfOrigin] = React.useState('');
  const [religion, setReligion] = React.useState('');
  const [healthNotes, setHealthNotes] = React.useState('');

  // Cascade
  const multiCampus = structure.campuses.length > 1;
  const [campusId, setCampusId] = React.useState('');
  const [stageId, setStageId] = React.useState('');
  const [yearLevelId, setYearLevelId] = React.useState('');
  const [streamId, setStreamId] = React.useState('');

  const [notes, setNotes] = React.useState('');
  const [guardians, setGuardians] = React.useState<Guardian[]>([
    emptyGuardian(true),
  ]);

  const yearLevels = React.useMemo(
    () => structure.yearLevels.filter((y) => !stageId || y.stageId === stageId),
    [structure.yearLevels, stageId],
  );

  function setGuardian(i: number, patch: Partial<Guardian>) {
    setGuardians((prev) =>
      prev.map((g, idx) => (idx === i ? { ...g, ...patch } : g)),
    );
  }
  function addGuardian() {
    setGuardians((prev) => [...prev, emptyGuardian(false)]);
  }
  function removeGuardian(i: number) {
    setGuardians((prev) => prev.filter((_, idx) => idx !== i));
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
        notes: notes.trim() || undefined,
        guardians: guardians.map((g, i) => ({
          fullName: g.fullName.trim(),
          relationship: g.relationship,
          email: g.email?.trim() || undefined,
          address: g.address?.trim() || undefined,
          phoneCountryCode: g.phoneCountryCode.trim() || '+234',
          phoneNumber: g.phoneNumber.trim(),
          whatsappSameAsPhone: g.whatsappSameAsPhone,
          whatsappCountryCode: g.whatsappSameAsPhone
            ? undefined
            : g.whatsappCountryCode?.trim() || '+234',
          whatsappNumber: g.whatsappSameAsPhone
            ? undefined
            : g.whatsappNumber?.trim() || undefined,
          isPrimary: i === 0,
        })),
      };
      const res = await fetch('/api/admissions/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        toast.error(await errorMessage(res, 'Could not submit application'));
        return;
      }
      const data = (await res.json()) as { id: string };
      toast.success('Application submitted');
      onCreated(data.id);
    } catch {
      toast.error('Network error — please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Applicant */}
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold">Applicant</h3>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ap-name">Full name</Label>
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
      </section>

      <Separator />

      {/* Applying for — cascade */}
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold">Applying for</h3>
        <p className="-mt-1 text-xs text-muted-foreground">
          Chosen from the school&apos;s own classes — an admit lands here with
          no re-keying.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
        </div>
      </section>

      <Separator />

      {/* Guardians */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Parents / guardians</h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addGuardian}
          >
            <Plus className="mr-1 size-3.5" aria-hidden /> Add
          </Button>
        </div>
        {guardians.map((g, i) => (
          <div
            key={i}
            className="flex flex-col gap-3 rounded-lg border border-border p-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                {i === 0 ? 'Primary contact' : `Guardian ${i + 1}`}
              </span>
              {i > 0 && (
                <button
                  type="button"
                  onClick={() => removeGuardian(i)}
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
                  onChange={(e) => setGuardian(i, { fullName: e.target.value })}
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
              <Label>Phone</Label>
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
            {!g.whatsappSameAsPhone && (
              <div className="flex flex-col gap-1.5">
                <Label>WhatsApp number</Label>
                <div className="flex gap-2">
                  <Input
                    value={g.whatsappCountryCode ?? ''}
                    onChange={(e) =>
                      setGuardian(i, { whatsappCountryCode: e.target.value })
                    }
                    className="w-20"
                    aria-label="WhatsApp country code"
                  />
                  <Input
                    value={g.whatsappNumber ?? ''}
                    onChange={(e) =>
                      setGuardian(i, { whatsappNumber: e.target.value })
                    }
                    className="flex-1"
                    placeholder="801 234 5678"
                    inputMode="tel"
                  />
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label>Email</Label>
                <Input
                  value={g.email ?? ''}
                  onChange={(e) => setGuardian(i, { email: e.target.value })}
                  placeholder="optional"
                  inputMode="email"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Address</Label>
                <Input
                  value={g.address ?? ''}
                  onChange={(e) => setGuardian(i, { address: e.target.value })}
                  placeholder="optional"
                />
              </div>
            </div>
          </div>
        ))}
      </section>

      <Separator />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ap-notes">Admissions notes</Label>
        <Textarea
          id="ap-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Sibling already enrolled in SSS 2 (optional)"
          rows={2}
        />
      </div>

      <div className="flex items-center justify-end gap-2">
        {onCancel && (
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </Button>
        )}
        <Button type="button" onClick={submit} disabled={busy || !canSubmit}>
          Submit application
        </Button>
      </div>
    </div>
  );
}
