'use client';

/* ============================================================
   PageHeader — Aurora Layout A main heading (`.main-head`)

   Title + meta sub-line on the left, an actions cluster on the
   right (segmented control, filters, primary action). Consumes
   the --content-padding token for horizontal alignment with the
   page body. Layout-stable: the row height is driven by the
   title, and actions wrap without shifting the title.
   ============================================================ */

import * as React from 'react';

import { cn } from '@workspace/ui/lib/utils';
import type { PageHeaderMeta } from '@workspace/ui/types/shell.types';

export interface SegmentedControlProps {
  options: { key: string; label: string }[];
  value: string;
  onValueChange?: (key: string) => void;
  className?: string;
}

/** The pill segmented control from the Aurora head actions. */
export function SegmentedControl({
  options,
  value,
  onValueChange,
  className,
}: SegmentedControlProps) {
  return (
    <div
      role="tablist"
      className={cn(
        'inline-flex gap-0.5 rounded-[var(--radius-sm)] border border-border bg-secondary p-0.5',
        className,
      )}
    >
      {options.map((option) => {
        const active = option.key === value;
        return (
          <button
            key={option.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onValueChange?.(option.key)}
            className={cn(
              'rounded-[calc(var(--radius-sm)-2px)] px-3 py-1 text-[12.5px] font-semibold whitespace-nowrap outline-none transition-colors',
              'focus-visible:ring-[3px] focus-visible:ring-ring/50',
              active
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export interface PageHeaderProps {
  title: string;
  /** Short freeform description rendered beneath the title. */
  description?: string;
  /** Structured meta facts rendered as a dotted sub-line. */
  meta?: PageHeaderMeta[];
  /** Right-aligned actions (segmented control, buttons, etc.). */
  actions?: React.ReactNode;
  /** Apply the standard --content-padding inset. */
  padded?: boolean;
  className?: string;
}

export function PageHeader({
  title,
  description,
  meta,
  actions,
  padded = true,
  className,
}: PageHeaderProps) {
  return (
    <div
      data-slot="page-header"
      className={cn(
        'flex shrink-0 flex-wrap items-center gap-x-3.5 gap-y-2.5',
        padded &&
          'px-[var(--content-padding)] pb-2.5 pt-[var(--content-padding)]',
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <h1 className="truncate text-[21px] font-extrabold leading-[1.05] tracking-[-0.02em] text-foreground">
          {title}
        </h1>
        {description ? (
          <p className="text-[12.5px] text-muted-foreground">{description}</p>
        ) : null}
        {meta?.length ? (
          <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-muted-foreground">
            {meta.map((fact, index) => (
              <React.Fragment key={fact.key}>
                {index > 0 ? (
                  <span aria-hidden className="opacity-60">
                    ·
                  </span>
                ) : null}
                <span
                  className={cn(
                    'whitespace-nowrap',
                    fact.emphasis && 'font-bold text-primary',
                  )}
                >
                  {fact.label}
                </span>
              </React.Fragment>
            ))}
          </div>
        ) : null}
      </div>

      {actions ? (
        <div className="ml-auto flex shrink-0 flex-wrap items-center gap-2.5">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
