'use client';

/* ============================================================
   InvoiceTotalsBar — the working total, at the foot of the bill

   These five figures used to be a row of stat tiles above the lines, which
   made the money the largest, loudest thing on a screen whose actual work is
   the line table — and pushed the lines themselves below the fold.

   A till puts them where a receipt puts them: a compact stack at the bottom
   right of the document, under the lines they are the sum of, with the one
   figure that matters (what is still owed) set apart and large. Counts lead,
   the way a POS shows "items sold / total qty", because "4 lines · qty 7" is
   how a line typed twice gets caught before the invoice is issued.

   It is `sticky bottom-0` inside the scroll column so a long bill still keeps
   its total against the lines being edited.

   The actions that COMMIT the composition (issue it, save it as a draft) sit
   in this same bar, on the left: the button that commits a figure belongs
   beside the figure, not in a page header two scroll-lengths away. Actions on
   the finished document — download, share — are not composition and stay in
   the page header.
   ============================================================ */

import * as React from 'react';

import { cn } from '@workspace/ui/lib/utils';

import { formatCount, formatNaira as naira } from '@/lib/format';

export interface InvoiceTotals {
  gross: number;
  discounts: number;
  net: number;
  paid: number;
  /** Part of `paid` that was drawn from the family's held credit. */
  credited?: number;
  balance: number;
  overpaid: number;
}

/** One label/figure pair in the stack. Figures are tabular so they align. */
function Row({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-6">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn('tabular-nums text-foreground', className)}>
        {value}
      </span>
    </div>
  );
}

export function InvoiceTotalsBar({
  lineCount,
  quantityTotal,
  financials,
  actions,
}: {
  lineCount: number;
  quantityTotal: number;
  financials: InvoiceTotals;
  /** Terminal actions on the composition — issue, save as draft. */
  actions?: React.ReactNode;
}) {
  const fin = financials;
  const owed = fin.overpaid > 0 ? fin.overpaid : fin.balance;

  return (
    <div
      data-slot="invoice-totals"
      role="group"
      aria-label="Invoice totals"
      className="sticky bottom-0 z-10 flex flex-wrap items-end justify-between gap-4 border-t border-border bg-card/85 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-card/70"
    >
      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : (
        <span />
      )}
      <div className="w-full max-w-xs text-[calc(12.5px*var(--font-scale))]">
        <Row label="Lines" value={formatCount(lineCount)} />
        <Row label="Total quantity" value={formatCount(quantityTotal)} />
        <Row label="Billed" value={naira(fin.gross)} />
        {fin.discounts > 0 ? (
          <Row label="Discounts" value={`−${naira(fin.discounts)}`} />
        ) : null}
        <Row label="Net" value={naira(fin.net)} className="font-medium" />
        {fin.paid > 0 ? (
          <Row
            label={fin.credited ? 'Paid (incl. credit)' : 'Paid'}
            value={naira(fin.paid)}
          />
        ) : null}

        {/* The one figure the whole surface exists to keep honest. */}
        <div className="mt-2 flex items-baseline justify-between gap-6 border-t border-border pt-2">
          <span className="font-semibold text-muted-foreground">
            {fin.overpaid > 0 ? 'Credit' : 'Amount due'}
          </span>
          {/* Weight carries the emphasis, not colour: an ordinary unpaid
              balance is the normal state of an invoice, and painting every
              one of them red made routine look like alarm. Red is kept for
              nothing here; credit still reads as good news. */}
          <span
            className={cn(
              'text-[calc(19px*var(--font-scale))] font-bold tabular-nums',
              fin.overpaid > 0 ? 'text-success' : 'text-foreground',
            )}
          >
            {naira(owed)}
          </span>
        </div>
      </div>
    </div>
  );
}
