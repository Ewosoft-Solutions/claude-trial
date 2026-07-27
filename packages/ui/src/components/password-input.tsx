'use client';

/* ============================================================
   PasswordInput — text field with a show/hide toggle

   Wraps the base Input and adds an eye button that reveals or masks
   the value. Spreads through every input prop (name, value, required,
   autoComplete, minLength, autoFocus…) so it is a drop-in for
   `<Input type="password" />`. The toggle is type="button" (never
   submits) and is skipped in the tab order — password managers and
   autofill still bind via `name` + `autoComplete`, unaffected by the
   momentary type swap.
   ============================================================ */

import * as React from 'react';
import { Eye, EyeOff } from 'lucide-react';

import { cn } from '@workspace/ui/lib/utils';
import { Input } from '@workspace/ui/components/input';

export type PasswordInputProps = Omit<React.ComponentProps<'input'>, 'type'> & {
  /** Accessible label for the reveal button when masked. */
  showLabel?: string;
  /** Accessible label for the reveal button when visible. */
  hideLabel?: string;
};

export function PasswordInput({
  className,
  showLabel = 'Show password',
  hideLabel = 'Hide password',
  ...props
}: PasswordInputProps) {
  const [visible, setVisible] = React.useState(false);

  return (
    <div className="relative">
      <Input
        type={visible ? 'text' : 'password'}
        className={cn('pr-10', className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? hideLabel : showLabel}
        aria-pressed={visible}
        // Kept out of the tab order so keyboard users flow field → submit;
        // the toggle stays reachable by pointer and screen-reader cursor.
        tabIndex={-1}
        className="absolute inset-y-0 right-0 grid w-10 place-items-center rounded-r-md text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        {visible ? (
          <EyeOff className="size-4" aria-hidden />
        ) : (
          <Eye className="size-4" aria-hidden />
        )}
      </button>
    </div>
  );
}
