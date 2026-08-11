'use client';

/**
 * WB3-3 · the application's answers to the school's current published form.
 * Renders each typed field (text / paragraph / number / date / choice / yes-no)
 * pre-filled from the saved response, and captures/updates it via
 * PUT /api/admissions/applications/:id/form-response.
 */
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { Button } from '@workspace/ui/components/button';
import { Input } from '@workspace/ui/components/input';
import { Label } from '@workspace/ui/components/label';
import { Textarea } from '@workspace/ui/components/textarea';
import { Checkbox } from '@workspace/ui/components/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select';

import {
  errorMessage,
  type FormFieldDef,
  type FormResponse,
  type FormVersion,
  type Perms,
} from '../admissions-types';

type AnswerMap = Record<string, unknown>;

export function FormResponsePanel({
  applicationId,
  form,
  response,
  perms,
}: {
  applicationId: string;
  form: FormVersion | null;
  response: FormResponse | null;
  perms: Perms;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [answers, setAnswers] = React.useState<AnswerMap>(
    () => (response?.answers as AnswerMap) ?? {},
  );

  if (!form) {
    return (
      <div className="flex flex-col gap-2 text-sm text-muted-foreground">
        <p>No application form has been published yet.</p>
        {perms.criteria && (
          <Button asChild variant="outline" size="sm" className="w-fit">
            <Link href="/admissions/forms">Build the application form</Link>
          </Button>
        )}
      </div>
    );
  }

  const set = (key: string, value: unknown) =>
    setAnswers((a) => ({ ...a, [key]: value }));

  async function save() {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/admissions/applications/${applicationId}/form-response`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ answers }),
        },
      );
      if (!res.ok) {
        toast.error(await errorMessage(res, 'Could not save the response'));
        return;
      }
      toast.success('Response saved');
      router.refresh();
    } catch {
      toast.error('Network error — please try again.');
    } finally {
      setBusy(false);
    }
  }

  const readOnly = !perms.create;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          {form.title} · v{form.version}
        </span>
      </div>
      <div className="flex flex-col gap-4">
        {form.fields.map((field) => (
          <FieldControl
            key={field.key}
            field={field}
            value={answers[field.key]}
            disabled={busy || readOnly}
            onChange={(v) => set(field.key, v)}
          />
        ))}
      </div>
      {!readOnly && (
        <div className="flex justify-end">
          <Button size="sm" disabled={busy} onClick={() => void save()}>
            {response ? 'Update response' : 'Save response'}
          </Button>
        </div>
      )}
    </div>
  );
}

function FieldControl({
  field,
  value,
  disabled,
  onChange,
}: {
  field: FormFieldDef;
  value: unknown;
  disabled: boolean;
  onChange: (value: unknown) => void;
}) {
  const id = `ff-${field.key}`;
  const label = (
    <Label htmlFor={id} className="text-sm">
      {field.label}
      {field.required && <span className="ml-1 text-destructive">*</span>}
    </Label>
  );
  const help = field.help ? (
    <span className="text-xs text-muted-foreground">{field.help}</span>
  ) : null;

  switch (field.type) {
    case 'paragraph':
      return (
        <div className="flex flex-col gap-1.5">
          {label}
          <Textarea
            id={id}
            value={(value as string) ?? ''}
            placeholder={field.placeholder}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
          />
          {help}
        </div>
      );
    case 'number':
      return (
        <div className="flex flex-col gap-1.5">
          {label}
          <Input
            id={id}
            type="number"
            inputMode="decimal"
            value={value === undefined || value === null ? '' : String(value)}
            placeholder={field.placeholder}
            disabled={disabled}
            onChange={(e) =>
              onChange(e.target.value === '' ? '' : Number(e.target.value))
            }
          />
          {help}
        </div>
      );
    case 'date':
      return (
        <div className="flex flex-col gap-1.5">
          {label}
          <Input
            id={id}
            type="date"
            value={(value as string) ?? ''}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
          />
          {help}
        </div>
      );
    case 'boolean':
      return (
        <div className="flex items-center gap-2">
          <Checkbox
            id={id}
            checked={value === true}
            disabled={disabled}
            onCheckedChange={(c) => onChange(c === true)}
          />
          {label}
        </div>
      );
    case 'select':
      return (
        <div className="flex flex-col gap-1.5">
          {label}
          <Select
            value={(value as string) ?? ''}
            disabled={disabled}
            onValueChange={(v) => onChange(v)}
          >
            <SelectTrigger id={id} className="w-full">
              <SelectValue placeholder="Choose…" />
            </SelectTrigger>
            <SelectContent>
              {(field.options ?? []).map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {help}
        </div>
      );
    case 'multiselect': {
      const selected = Array.isArray(value) ? (value as string[]) : [];
      const toggle = (opt: string) =>
        onChange(
          selected.includes(opt)
            ? selected.filter((o) => o !== opt)
            : [...selected, opt],
        );
      return (
        <div className="flex flex-col gap-1.5">
          {label}
          <div className="flex flex-col gap-1.5">
            {(field.options ?? []).map((opt) => (
              <label key={opt} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={selected.includes(opt)}
                  disabled={disabled}
                  onCheckedChange={() => toggle(opt)}
                />
                {opt}
              </label>
            ))}
          </div>
          {help}
        </div>
      );
    }
    case 'text':
    default:
      return (
        <div className="flex flex-col gap-1.5">
          {label}
          <Input
            id={id}
            value={(value as string) ?? ''}
            placeholder={field.placeholder}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
          />
          {help}
        </div>
      );
  }
}
