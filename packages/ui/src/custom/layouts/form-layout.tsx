'use client';

/* ============================================================
   FormLayout + FormSection — data-entry scaffold

   FormLayout wraps a <form>: an optional validation-summary slot at
   the top (wire the M5 ValidationSummary here), the field sections,
   a sticky-bottom action bar, and an optional aside (help / tips).
   FormSection is a titled group — heading + description in a leading
   column, fields in a responsive grid beside it. Slots + typed
   structure only; copy stays consumer-supplied.
   ============================================================ */

import * as React from 'react';

import { cn } from '@workspace/ui/lib/utils';

export interface FormLayoutProps {
  /** Native submit handler. */
  onSubmit?: React.FormEventHandler<HTMLFormElement>;
  /** Validation-summary slot, rendered above the fields. */
  validation?: React.ReactNode;
  /** Field sections — typically <FormSection/> children. */
  children: React.ReactNode;
  /** Action bar slot (Save / Cancel buttons). */
  actions?: React.ReactNode;
  /** Optional aside column (help text, contextual tips). */
  aside?: React.ReactNode;
  className?: string;
}

export function FormLayout({
  onSubmit,
  validation,
  children,
  actions,
  aside,
  className,
}: FormLayoutProps) {
  const form = (
    <form
      noValidate
      onSubmit={onSubmit}
      data-slot="form-layout"
      className={cn('flex min-w-0 flex-col gap-6', !aside && className)}
    >
      {validation}
      <div className="flex flex-col divide-y divide-border">{children}</div>
      {actions ? (
        <div className="flex flex-wrap items-center justify-end gap-2.5 border-t border-border pt-5">
          {actions}
        </div>
      ) : null}
    </form>
  );

  if (!aside) return form;

  return (
    <div
      className={cn('grid grid-cols-1 gap-6 @5xl/main:grid-cols-3', className)}
    >
      <div className="@5xl/main:col-span-2">{form}</div>
      <aside className="@5xl/main:col-span-1">
        <div className="@5xl/main:sticky @5xl/main:top-4">{aside}</div>
      </aside>
    </div>
  );
}

export interface FormSectionProps {
  /** Section heading. */
  title: string;
  /** Optional description beneath the heading. */
  description?: React.ReactNode;
  /** The fields. */
  children: React.ReactNode;
  /** Field columns within the section. Defaults to 1. */
  columns?: 1 | 2;
  className?: string;
}

export function FormSection({
  title,
  description,
  children,
  columns = 1,
  className,
}: FormSectionProps) {
  return (
    <section
      data-slot="form-section"
      className={cn(
        'grid grid-cols-1 gap-x-8 gap-y-4 py-6 first:pt-0 @5xl/main:grid-cols-3',
        className,
      )}
    >
      <div className="@5xl/main:col-span-1">
        <h3 className="text-sm font-bold text-foreground">{title}</h3>
        {description ? (
          <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      <div
        className={cn(
          'grid gap-4 @5xl/main:col-span-2',
          columns === 2 ? '@xl/main:grid-cols-2' : 'grid-cols-1',
        )}
      >
        {children}
      </div>
    </section>
  );
}
