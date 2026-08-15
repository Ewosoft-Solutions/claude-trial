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
import { NameFields } from '@workspace/ui/custom/forms/name-fields';
import {
  FormValidationError,
  answersToCreateApplicationInput,
  hasSystemIntake,
  systemSectionsOnly,
  validateAnswers,
  type FormDefinition,
  type PersonNameParts,
} from '@workspace/forms';
import {
  FormRenderer,
  type CascadeStructure,
} from '@workspace/ui/custom/forms/form-renderer';

import {
  GENDERS,
  errorMessage,
  type Guardian,
  type IntakeStructure,
} from './admissions-types';
import {
  GuardiansEditor,
  emptyGuardian,
  guardiansPayload,
} from './admission-form-fields';

const NONE = '__none__';

/**
 * New Application. When the school's published form carries the standard intake
 * as bound `system` sections, the form is rendered from that definition (so the
 * school's relabel / reorder / optional / hide edits take effect) and mapped to
 * the SAME `createApplication` payload. Otherwise (a tenant whose form predates
 * the system sections) the built-in structured layout is used unchanged.
 */
export function NewApplicationForm({
  structure,
  formDefinition,
  onCreated,
  onCancel,
}: {
  structure: IntakeStructure;
  formDefinition?: FormDefinition | null;
  onCreated: (id: string) => void;
  onCancel?: () => void;
}) {
  if (formDefinition && hasSystemIntake(formDefinition)) {
    return (
      <SystemDrivenApplication
        definition={formDefinition}
        structure={structure}
        onCreated={onCreated}
        onCancel={onCancel}
      />
    );
  }
  return (
    <BespokeApplicationForm
      structure={structure}
      onCreated={onCreated}
      onCancel={onCancel}
    />
  );
}

/** Adapt the admissions IntakeStructure to the cascade renderer's shape. */
function toCascadeStructure(structure: IntakeStructure): CascadeStructure {
  return {
    campuses: structure.campuses.map((c) => ({ id: c.id, name: c.name })),
    stages: structure.stages.map((s) => ({ id: s.id, name: s.name })),
    yearLevels: structure.yearLevels.map((y) => ({
      id: y.id,
      name: y.name,
      stageId: y.stageId,
    })),
    streams: structure.streams.map((s) => ({ id: s.id, name: s.name })),
  };
}

/**
 * The definition-driven variant: render the form's SYSTEM sections (applicant,
 * applying-for cascade, guardians) via the shared FormRenderer, then map the
 * bound answers onto the unchanged createApplication payload. A staff-only
 * "Admissions notes" field is appended (it is not part of the applicant-facing
 * form).
 */
function SystemDrivenApplication({
  definition,
  structure,
  onCreated,
  onCancel,
}: {
  definition: FormDefinition;
  structure: IntakeStructure;
  onCreated: (id: string) => void;
  onCancel?: () => void;
}) {
  const [busy, setBusy] = React.useState(false);
  const [answers, setAnswers] = React.useState<Record<string, unknown>>({});
  const [notes, setNotes] = React.useState('');

  const sysDef = React.useMemo(
    () => systemSectionsOnly(definition),
    [definition],
  );
  const cascadeStructure = React.useMemo(
    () => toCascadeStructure(structure),
    [structure],
  );

  async function submit() {
    // Client-side check mirrors the renderer's own submit (nice inline error);
    // the server re-validates the mapped payload regardless.
    try {
      validateAnswers(sysDef, answers);
    } catch (e) {
      toast.error(
        e instanceof FormValidationError
          ? e.message
          : 'Please check your answers.',
      );
      return;
    }
    setBusy(true);
    try {
      const input = answersToCreateApplicationInput(definition, answers);
      const payload = { ...input, notes: notes.trim() || undefined };
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
      <FormRenderer
        flat
        definition={sysDef}
        value={answers}
        onChange={setAnswers}
        structure={cascadeStructure}
        submitting={busy}
      />

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
        <Button type="button" onClick={() => void submit()} disabled={busy}>
          {busy ? 'Submitting…' : 'Submit application'}
        </Button>
      </div>
    </div>
  );
}

function BespokeApplicationForm({
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
  const [applicant, setApplicant] = React.useState<PersonNameParts>({
    title: '',
    firstName: '',
    middleName: '',
    surname: '',
  });
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

  const primary = guardians[0];
  const canSubmit =
    !!applicant.firstName?.trim() &&
    !!applicant.surname?.trim() &&
    !!yearLevelId &&
    !!primary?.firstName?.trim() &&
    !!primary?.surname?.trim() &&
    !!primary?.phoneNumber.trim();

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    try {
      const payload = {
        applicantTitle: applicant.title?.trim() || undefined,
        applicantFirstName: (applicant.firstName ?? '').trim(),
        applicantMiddleName: applicant.middleName?.trim() || undefined,
        applicantSurname: (applicant.surname ?? '').trim(),
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
        guardians: guardiansPayload(guardians),
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
        <NameFields
          idPrefix="applicant"
          value={applicant}
          onChange={setApplicant}
        />
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
      <GuardiansEditor guardians={guardians} onChange={setGuardians} />

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
