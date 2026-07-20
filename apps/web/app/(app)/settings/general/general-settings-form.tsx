'use client';

import * as React from 'react';

import { Button } from '@workspace/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card';
import { Input } from '@workspace/ui/components/input';
import { Label } from '@workspace/ui/components/label';
import { STEP_UP_OPERATION } from '@/lib/step-up';
import { useStepUpAction } from '../../_shared/use-step-up-action';

export interface GeneralSettings {
  schoolName: string;
  shortName: string;
  contactEmail: string;
  phone: string;
  address: string;
  academicYear: string;
  currentTerm: string;
  timezone: string;
  currency: string;
  emailDomain: string;
}

function Field({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

export function GeneralSettingsForm({
  initial,
  canEdit,
}: {
  initial: GeneralSettings;
  canEdit: boolean;
}) {
  const [values, setValues] = React.useState(initial);
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const { requestStepUp, stepUpPrompt } = useStepUpAction();

  function field(key: keyof GeneralSettings) {
    return {
      value: values[key],
      onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
        setValues((current) => ({ ...current, [key]: event.target.value })),
      disabled: !canEdit,
    };
  }

  async function save(stepUpChallengeId: string) {
    if (!canEdit) return;
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch('/api/tenant/configuration', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stepUpChallengeId,
          name: values.schoolName,
          emailDomain: values.emailDomain,
          settings: {
            general: {
              shortName: values.shortName,
              contactEmail: values.contactEmail,
              phone: values.phone,
              address: values.address,
            },
            locale: {
              academicYear: values.academicYear,
              currentTerm: values.currentTerm,
              timezone: values.timezone,
              currency: values.currency,
            },
          },
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.error ?? 'Could not save school settings.');
      }
      setMessage('School settings saved.');
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Could not save school settings.',
      );
    } finally {
      setSaving(false);
    }
  }

  const profileFields: Array<{
    key: keyof GeneralSettings;
    label: string;
    type?: React.HTMLInputTypeAttribute;
    wide?: boolean;
  }> = [
    { key: 'schoolName', label: 'School name' },
    { key: 'shortName', label: 'Short name' },
    { key: 'contactEmail', label: 'Contact email', type: 'email' },
    { key: 'phone', label: 'Phone', type: 'tel' },
    { key: 'address', label: 'Address', wide: true },
  ];
  const localeFields: Array<{
    key: keyof GeneralSettings;
    label: string;
    wide?: boolean;
  }> = [
    { key: 'academicYear', label: 'Academic year' },
    { key: 'currentTerm', label: 'Current term' },
    { key: 'timezone', label: 'Timezone' },
    { key: 'currency', label: 'Currency' },
    { key: 'emailDomain', label: 'Email domain', wide: true },
  ];

  return (
    <div className="flex flex-col gap-5">
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-base">School profile</CardTitle>
          <CardDescription>
            Shared identity and contact details for the active school.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 @xl/main:grid-cols-2">
          {profileFields.map((item) => (
            <div
              key={item.key}
              className={item.wide ? '@xl/main:col-span-2' : undefined}
            >
              <Field id={`school-${item.key}`} label={item.label}>
                <Input
                  id={`school-${item.key}`}
                  type={item.type}
                  {...field(item.key)}
                />
              </Field>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Academic & locale</CardTitle>
          <CardDescription>
            Defaults used for terms, scheduling, and formatting.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 @xl/main:grid-cols-2">
          {localeFields.map((item) => (
            <div
              key={item.key}
              className={item.wide ? '@xl/main:col-span-2' : undefined}
            >
              <Field id={`school-${item.key}`} label={item.label}>
                <Input id={`school-${item.key}`} {...field(item.key)} />
              </Field>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-end gap-2.5">
        <span className="mr-auto text-sm" aria-live="polite">
          {message ? <span className="text-success">{message}</span> : null}
          {error ? <span className="text-destructive">{error}</span> : null}
          {!canEdit ? (
            <span className="text-muted-foreground">
              You have read-only access.
            </span>
          ) : null}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setValues(initial)}
          disabled={saving || !canEdit}
        >
          Reset
        </Button>
        <Button
          size="sm"
          onClick={() =>
            requestStepUp(
              {
                operation: STEP_UP_OPERATION.SYSTEM_CONFIGURATION,
                title: 'Confirm school settings change',
                description:
                  'These settings affect the whole school and require a fresh identity confirmation.',
              },
              save,
            )
          }
          disabled={saving || !canEdit}
        >
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
      {stepUpPrompt}
    </div>
  );
}
