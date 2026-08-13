'use client';

/**
 * Edit an existing applicant — profile + guardians. Corrects the record after
 * creation (a typo in the name, a new guardian phone). PATCHes
 * /api/admissions/applications/:id; the "applying for" class is not edited here.
 * Reuses the shared GuardiansEditor so it stays in step with the New form.
 */
import * as React from 'react';
import { toast } from 'sonner';

import { Button } from '@workspace/ui/components/button';
import { Label } from '@workspace/ui/components/label';
import { Input } from '@workspace/ui/components/input';
import { Textarea } from '@workspace/ui/components/textarea';
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
  errorMessage,
  type ApplicationDetail,
  type Guardian,
} from '../admissions-types';
import {
  GuardiansEditor,
  guardiansPayload,
  guardiansToEditor,
} from '../admission-form-fields';

export function EditApplicationForm({
  detail,
  onSaved,
  onCancel,
}: {
  detail: ApplicationDetail;
  onSaved: () => void;
  onCancel?: () => void;
}) {
  const [busy, setBusy] = React.useState(false);
  const [name, setName] = React.useState(detail.applicantName ?? '');
  const [dob, setDob] = React.useState(
    detail.dateOfBirth ? detail.dateOfBirth.slice(0, 10) : '',
  );
  const [gender, setGender] = React.useState(detail.gender ?? '');
  const [stateOfOrigin, setStateOfOrigin] = React.useState(
    detail.stateOfOrigin ?? '',
  );
  const [religion, setReligion] = React.useState(detail.religion ?? '');
  const [healthNotes, setHealthNotes] = React.useState(
    detail.healthNotes ?? '',
  );
  const [notes, setNotes] = React.useState(detail.notes ?? '');
  const [guardians, setGuardians] = React.useState<Guardian[]>(
    guardiansToEditor(detail.guardians),
  );

  const primary = guardians[0];
  const canSubmit =
    !!name.trim() &&
    !!primary?.fullName.trim() &&
    !!primary?.phoneNumber.trim();

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    try {
      const payload = {
        applicantName: name.trim(),
        dateOfBirth: dob || undefined,
        gender: gender || undefined,
        stateOfOrigin: stateOfOrigin.trim(),
        religion: religion.trim(),
        healthNotes: healthNotes.trim(),
        notes: notes.trim(),
        guardians: guardiansPayload(guardians),
      };
      const res = await fetch(`/api/admissions/applications/${detail.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        toast.error(await errorMessage(res, 'Could not save changes'));
        return;
      }
      toast.success('Applicant updated');
      onSaved();
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
          <Label htmlFor="ed-name">Full name</Label>
          <Input
            id="ed-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Ada Okoro"
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ed-dob">Date of birth</Label>
            <Input
              id="ed-dob"
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
            <Label htmlFor="ed-state">State of origin</Label>
            <Input
              id="ed-state"
              value={stateOfOrigin}
              onChange={(e) => setStateOfOrigin(e.target.value)}
              placeholder="e.g. Anambra"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ed-religion">Religion</Label>
            <Input
              id="ed-religion"
              value={religion}
              onChange={(e) => setReligion(e.target.value)}
              placeholder="optional"
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ed-health">Health notes</Label>
          <Textarea
            id="ed-health"
            value={healthNotes}
            onChange={(e) => setHealthNotes(e.target.value)}
            placeholder="Allergies, conditions, medication… (optional)"
            rows={2}
          />
        </div>
      </section>

      <Separator />

      <GuardiansEditor guardians={guardians} onChange={setGuardians} />

      <Separator />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ed-notes">Admissions notes</Label>
        <Textarea
          id="ed-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Internal notes (optional)"
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
          Save changes
        </Button>
      </div>
    </div>
  );
}
