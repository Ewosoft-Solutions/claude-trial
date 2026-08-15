'use client';

/**
 * WB3-3 · the application's answers to the school's current published form,
 * rendered by the reusable <FormRenderer> (sections, branching, validation).
 * Captures/updates via PUT /api/admissions/applications/:id/form-response.
 */
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { Button } from '@workspace/ui/components/button';
import { FormRenderer } from '@workspace/ui/custom/forms/form-renderer';
import { withoutSystemSections } from '@workspace/forms';

import {
  errorMessage,
  type FormResponse,
  type FormVersion,
  type Perms,
} from '../admissions-types';

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
  const [answers, setAnswers] = React.useState<Record<string, unknown>>(
    () => (response?.answers as Record<string, unknown>) ?? {},
  );

  if (!form) {
    return (
      <div className="flex flex-col gap-2 text-sm text-muted-foreground">
        <p>No application form has been published yet.</p>
        {perms.criteria && (
          <Button asChild variant="outline" size="sm" className="w-fit">
            <Link href="/students/admissions/form">
              Build the application form
            </Link>
          </Button>
        )}
      </div>
    );
  }

  const readOnly = !perms.create;

  // The response covers the school's own (custom) questions; the standard fields
  // are the bound system sections, captured structurally on the application.
  const customDefinition = withoutSystemSections(form.definition);
  const hasCustomQuestions = customDefinition.sections.some(
    (s) => s.items.length > 0,
  );

  if (!hasCustomQuestions) {
    return (
      <p className="text-sm text-muted-foreground">
        This form has no additional questions beyond the standard applicant,
        class and guardian details.
      </p>
    );
  }

  async function save(a: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/admissions/applications/${applicationId}/form-response`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ answers: a }),
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

  return (
    <div className="flex flex-col gap-4">
      <span className="text-xs text-muted-foreground">
        {customDefinition.title} · v{form.version}
      </span>
      <FormRenderer
        definition={customDefinition}
        value={answers}
        onChange={setAnswers}
        onSubmit={readOnly ? undefined : save}
        submitting={busy}
        readOnly={readOnly}
        submitLabel={response ? 'Update response' : 'Save response'}
      />
    </div>
  );
}
