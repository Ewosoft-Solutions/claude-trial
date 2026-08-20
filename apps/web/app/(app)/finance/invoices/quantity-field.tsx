'use client';

/* ============================================================
   QuantityField — a count, not a text box

   The quantity box was a plain input that accepted anything typed at it. It
   held "First term1" for a while during testing, and nothing said why the Add
   button had gone quiet — the value was simply not a number and the form had
   no way to say so.

   A quantity is a whole count of things: at least one, never a fraction, never
   negative. This enforces that in the control rather than checking it after
   the fact, and offers the two buttons that cover most of the actual use —
   nobody types "3" as often as they tap up twice.
   ============================================================ */

import * as React from 'react';
import { Minus, Plus } from 'lucide-react';

import { Button } from '@workspace/ui/components/button';
import { Input } from '@workspace/ui/components/input';
import { cn } from '@workspace/ui/lib/utils';

import { MIN_QUANTITY, parseQuantity } from '@/lib/invoice-lines';

export function QuantityField({
  value,
  onChange,
  disabled,
  label = 'Quantity',
  className,
}: {
  /** The current count. Always a valid quantity — the control never emits one that isn't. */
  value: number;
  onChange: (next: number) => void;
  disabled?: boolean;
  label?: string;
  className?: string;
}) {
  // What is being typed, which may briefly not be a number (mid-edit, or
  // emptied to retype). The committed value only moves when it parses.
  const [typed, setTyped] = React.useState(String(value));

  React.useEffect(() => setTyped(String(value)), [value]);

  const commit = (raw: string) => {
    const parsed = parseQuantity(raw);
    // An unparseable box snaps back to the last good count rather than
    // leaving the form in a state whose only symptom is a disabled button.
    if (parsed == null) setTyped(String(value));
    else if (parsed !== value) onChange(parsed);
  };

  return (
    <div className={cn('flex items-center justify-end gap-0.5', className)}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-7 shrink-0"
        disabled={disabled || value <= MIN_QUANTITY}
        aria-label={`Decrease ${label.toLowerCase()}`}
        onClick={() => onChange(Math.max(MIN_QUANTITY, value - 1))}
      >
        <Minus className="size-3.5" aria-hidden />
      </Button>
      <Input
        value={typed}
        aria-label={label}
        // `inputMode` raises the numeric keypad on a phone; the filter below is
        // what actually keeps letters out, since inputMode is only a hint.
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        disabled={disabled}
        onChange={(e) => setTyped(e.target.value.replace(/[^\d]/g, ''))}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp') {
            e.preventDefault();
            onChange(value + 1);
          }
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            onChange(Math.max(MIN_QUANTITY, value - 1));
          }
        }}
        className="h-8 w-12 px-1 text-center tabular-nums"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-7 shrink-0"
        disabled={disabled}
        aria-label={`Increase ${label.toLowerCase()}`}
        onClick={() => onChange(value + 1)}
      >
        <Plus className="size-3.5" aria-hidden />
      </Button>
    </div>
  );
}
