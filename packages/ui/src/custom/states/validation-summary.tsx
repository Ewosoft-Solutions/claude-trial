'use client';

/* ============================================================
   ValidationSummary — grouped form-error pattern

   Renders the list of validation problems for a form in one place
   (typically pinned above the form, shown after a failed submit).
   `role="alert"` announces it; it is focusable (`tabIndex={-1}`) so
   the form can move focus to it on submit — pass `autoFocus` or use
   the forwarded ref. Items with a `fieldId` render as links that
   focus the offending control.

   Copy is consumer-supplied (title + each item's message).
   ============================================================ */

import * as React from 'react';
import { CircleAlert } from 'lucide-react';

import { cn } from '@workspace/ui/lib/utils';
import type { ValidationItem } from '@workspace/ui/types/states.types';

export interface ValidationSummaryProps {
  /** Heading, e.g. "Please fix the following". Consumer-supplied. */
  title: string;
  /** The problems to list. When empty, nothing renders. */
  items: ValidationItem[];
  /** Move focus to the summary on mount (after a failed submit). */
  autoFocus?: boolean;
  /**
   * Override what happens when an item is activated. By default an
   * item with `fieldId` focuses and scrolls to that control.
   */
  onSelectItem?: (item: ValidationItem) => void;
  className?: string;
}

export const ValidationSummary = React.forwardRef<
  HTMLDivElement,
  ValidationSummaryProps
>(function ValidationSummary(
  { title, items, autoFocus = false, onSelectItem, className },
  forwardedRef,
) {
  const innerRef = React.useRef<HTMLDivElement>(null);
  React.useImperativeHandle(forwardedRef, () => innerRef.current as HTMLDivElement);

  React.useEffect(() => {
    if (autoFocus && items.length > 0) {
      innerRef.current?.focus();
    }
    // Re-focus whenever the set of problems changes (e.g. resubmit).
  }, [autoFocus, items]);

  if (items.length === 0) return null;

  const focusField = (item: ValidationItem) => {
    if (onSelectItem) {
      onSelectItem(item);
      return;
    }
    if (!item.fieldId) return;
    const el = document.getElementById(item.fieldId);
    if (el) {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      (el as HTMLElement).focus({ preventScroll: true });
    }
  };

  return (
    <div
      ref={innerRef}
      data-slot="validation-summary"
      role="alert"
      aria-live="assertive"
      tabIndex={-1}
      className={cn(
        'rounded-[var(--radius-sm)] border border-destructive/30 bg-destructive/8 p-3.5 outline-none',
        'focus-visible:ring-[3px] focus-visible:ring-destructive/30',
        className,
      )}
    >
      <div className="flex items-center gap-2 text-sm font-semibold text-destructive">
        <CircleAlert aria-hidden className="size-4 shrink-0" />
        <span>{title}</span>
      </div>
      <ul className="mt-2 space-y-1 ps-6 text-sm text-foreground">
        {items.map((item) => (
          <li key={item.key} className="list-disc">
            {item.fieldId || onSelectItem ? (
              <button
                type="button"
                onClick={() => focusField(item)}
                className={cn(
                  'text-left underline-offset-2 outline-none hover:underline',
                  'focus-visible:ring-[3px] focus-visible:ring-destructive/30 rounded-sm',
                )}
              >
                {item.message}
              </button>
            ) : (
              <span>{item.message}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
});
