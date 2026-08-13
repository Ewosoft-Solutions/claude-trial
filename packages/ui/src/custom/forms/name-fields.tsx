'use client';

/**
 * NameFields — the ONE way to capture a person's name anywhere in the app
 * (students, guardians, staff, everyone): an optional Title, a First name, an
 * optional Middle name, and a Surname. Never a single "full name" input, so a
 * surface can always read the exact part it needs. Display is composed from the
 * parts via `formatPersonName` (@workspace/forms).
 *
 * Controlled: the parent owns `value` (PersonNameParts) + `onChange`.
 */
import * as React from 'react';

import { cn } from '@workspace/ui/lib/utils';
import { Input } from '@workspace/ui/components/input';
import { Label } from '@workspace/ui/components/label';
import { TITLE_SUGGESTIONS, type PersonNameParts } from '@workspace/forms';

export interface NameFieldsProps {
  value: PersonNameParts;
  onChange: (next: PersonNameParts) => void;
  disabled?: boolean;
  /** Unique prefix for field ids + the title datalist (one per instance). */
  idPrefix: string;
  /** Mark First + Surname required with an asterisk (default true). */
  required?: boolean;
  className?: string;
}

export function NameFields({
  value,
  onChange,
  disabled,
  idPrefix,
  required = true,
  className,
}: NameFieldsProps) {
  const set = (patch: Partial<PersonNameParts>) =>
    onChange({ ...value, ...patch });
  const listId = `${idPrefix}-titles`;
  const star = required ? (
    <span className="ml-0.5 text-destructive">*</span>
  ) : null;

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[6rem_1fr]">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}-title`}>Title</Label>
          <Input
            id={`${idPrefix}-title`}
            list={listId}
            value={value.title ?? ''}
            placeholder="e.g. Mr"
            autoComplete="honorific-prefix"
            disabled={disabled}
            onChange={(e) => set({ title: e.target.value })}
          />
          <datalist id={listId}>
            {TITLE_SUGGESTIONS.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}-first`}>First name{star}</Label>
          <Input
            id={`${idPrefix}-first`}
            value={value.firstName ?? ''}
            placeholder="e.g. Ada"
            autoComplete="given-name"
            disabled={disabled}
            onChange={(e) => set({ firstName: e.target.value })}
          />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}-middle`}>Middle name</Label>
          <Input
            id={`${idPrefix}-middle`}
            value={value.middleName ?? ''}
            placeholder="optional"
            autoComplete="additional-name"
            disabled={disabled}
            onChange={(e) => set({ middleName: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}-surname`}>Surname{star}</Label>
          <Input
            id={`${idPrefix}-surname`}
            value={value.surname ?? ''}
            placeholder="e.g. Okoro"
            autoComplete="family-name"
            disabled={disabled}
            onChange={(e) => set({ surname: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}
