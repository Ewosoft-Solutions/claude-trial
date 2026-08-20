'use client';

/* ============================================================
   A saved draft, edited in the browser and pushed once

   Every change used to be a request. That is correct — the server is the truth
   — but a bill is edited in bursts: add six lines, fix two quantities, then
   you are done. Writing each of those separately spends round trips on
   decisions the bursar has already made and is still making.

   The working copy lives here instead, and "Update draft" sends it in one
   request. Nothing is written until then, which is why `dirty` matters enough
   to be tracked properly rather than guessed at: it drives the save button,
   the unsaved-changes warning, and whether issuing needs a save first.

   Consequence worth stating: this is a REPLACE, so two people editing one
   draft means the second save overwrites the first. That is the trade the
   owner chose for a surface where one bursar composes one bill.
   ============================================================ */

import * as React from 'react';

import { deriveFinancials } from '@/lib/invoice-lines';
import type { ApiInvoiceDetail, ApiLine } from './invoice-detail-client';

/** A line the browser added that the server has not seen yet. */
export const PENDING_PREFIX = 'pending-';
export const isPending = (id: string) => id.startsWith(PENDING_PREFIX);

export interface DraftHeader {
  termName: string | null;
  termYear: number | null;
  termCycle: number | null;
  dueDate: string | null;
  notes: string | null;
}

function headerOf(invoice: ApiInvoiceDetail): DraftHeader {
  return {
    termName: invoice.termName ?? null,
    termYear: invoice.termYear ?? null,
    termCycle: invoice.termCycle ?? null,
    dueDate: invoice.dueDate ?? null,
    notes: invoice.notes ?? null,
  };
}

/**
 * What "changed" means, reduced to the fields that get saved.
 *
 * Comparing whole objects would call a draft dirty because the server sent a
 * new timestamp, and the save button would never go quiet.
 */
function signature(lines: ApiLine[], header: DraftHeader): string {
  return JSON.stringify({
    lines: lines.map((l) => [
      isPending(l.id) ? null : l.id,
      l.feeItemId,
      l.amount,
      l.quantity,
      l.description ?? '',
    ]),
    header,
  });
}

export function useDraftEditor(invoice: ApiInvoiceDetail) {
  const [lines, setLines] = React.useState<ApiLine[]>(invoice.lines);
  const [header, setHeader] = React.useState<DraftHeader>(() =>
    headerOf(invoice),
  );
  // The server's version as last seen — what `dirty` is measured against.
  const [baseline, setBaseline] = React.useState(() =>
    signature(invoice.lines, headerOf(invoice)),
  );

  // Adopt a fresh payload. Its identity changes only when the server sends one
  // — a navigation or an explicit refresh — not on every local re-render, so
  // this cannot clobber an edit in progress.
  React.useEffect(() => {
    setLines(invoice.lines);
    setHeader(headerOf(invoice));
    setBaseline(signature(invoice.lines, headerOf(invoice)));
  }, [invoice]);

  const dirty = signature(lines, header) !== baseline;

  const financials = React.useMemo(
    () => deriveFinancials(lines, invoice.financials),
    [lines, invoice.financials],
  );

  const patchHeader = React.useCallback(
    <K extends keyof DraftHeader>(field: K, value: DraftHeader[K]) =>
      setHeader((current) => ({ ...current, [field]: value })),
    [],
  );

  /** The payload the save endpoint reconciles against. */
  const contents = React.useCallback(
    () => ({
      ...header,
      lines: lines.map((line) => ({
        // A pending line has no server id yet, and sending the placeholder
        // would have the server reject it as belonging to another invoice.
        ...(isPending(line.id) ? {} : { id: line.id }),
        feeItemId: line.feeItemId,
        amount: line.amount,
        quantity: line.quantity,
        description: line.description ?? undefined,
      })),
    }),
    [header, lines],
  );

  /** Called after a successful save so the next edit measures from here. */
  const markSaved = React.useCallback((saved: ApiInvoiceDetail) => {
    setLines(saved.lines);
    setHeader(headerOf(saved));
    setBaseline(signature(saved.lines, headerOf(saved)));
  }, []);

  // Closing a tab mid-edit should cost a prompt, not the work. Browsers only
  // honour this after an interaction, which composing certainly is.
  React.useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  return {
    lines,
    setLines,
    header,
    patchHeader,
    financials,
    dirty,
    contents,
    markSaved,
  };
}
