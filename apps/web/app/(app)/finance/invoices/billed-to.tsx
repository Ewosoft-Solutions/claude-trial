'use client';

/* ============================================================
   BilledToBlock — who the bill is for

   Shared by the invoice route and the compose route: a bill being written and
   a bill being read should introduce themselves the same way, and the block is
   also what the PDF header will carry.
   ============================================================ */

import * as React from 'react';

/**
 * Who the bill is for, assembled by the server.
 *
 * Finance stores the payer's name as a snapshot and does not join the student
 * schema, so the number and class come from the roster. Every field is
 * nullable: an admission invoice has no student row yet, and an invoice with
 * no household is billed to the child directly.
 */
export interface BilledTo {
  name: string | null;
  studentNumber: string | null;
  className: string | null;
  householdName: string | null;
  payerName: string | null;
}

/**
 * Who the bill is for, at the head of the billing card.
 *
 * An invoice is a document sent to a family, and every real one opens by
 * saying who owes it. Ours said only the student's name, in the page title —
 * fine while you are looking at one on screen, useless the moment it is
 * printed, shared, or opened by someone who did not navigate here.
 *
 * Each fact is dropped when absent rather than rendered blank: an admission
 * invoice has no student row yet, and an invoice with no household is billed
 * to the child directly. An empty "Household —" would imply something missing
 * where nothing is.
 */
export function BilledToBlock({ billedTo }: { billedTo: BilledTo }) {
  const facts = [
    { key: 'number', label: 'Student no.', value: billedTo.studentNumber },
    { key: 'class', label: 'Class', value: billedTo.className },
    { key: 'household', label: 'Household', value: billedTo.householdName },
    { key: 'payer', label: 'Payer', value: billedTo.payerName },
  ].filter((fact) => fact.value);

  if (!billedTo.name && facts.length === 0) return null;

  return (
    <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 border-b border-border px-4 py-3">
      <div className="flex min-w-0 flex-col">
        <span className="text-[calc(11px*var(--font-scale))] uppercase tracking-wider text-muted-foreground">
          Billed to
        </span>
        <span className="font-medium text-foreground">
          {billedTo.name ?? 'Unnamed'}
        </span>
      </div>
      {facts.map((fact) => (
        <span
          key={fact.key}
          className="flex items-baseline gap-1.5 text-[calc(12.5px*var(--font-scale))]"
        >
          <span className="text-muted-foreground">{fact.label}</span>
          <span className="text-foreground">{fact.value}</span>
        </span>
      ))}
    </div>
  );
}
