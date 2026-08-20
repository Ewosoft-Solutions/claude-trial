'use client';

/* ============================================================
   The invoice as the bursar currently sees it

   Every line edit used to write and then `router.refresh()`, which re-ran the
   whole server component — invoice, catalogue, roster and session — so one tap
   of a quantity stepper cost a write plus a full page re-fetch before the
   number moved. Editing a bill felt like operating a form over a modem.

   The screen now moves first and the server catches up. The server is still
   the truth: a failed write rolls the screen back to what it actually holds,
   and fresh props always win over local state, so another session's change
   is not papered over by a stale copy.

   This is NOT the compose model. A saved draft is a shared object, so its
   changes are still written as they are made — they are just no longer
   round-tripped before being believed.
   ============================================================ */

import * as React from 'react';
import { toast } from 'sonner';

import type { ApiInvoiceDetail, ApiLine } from './invoice-detail-client';
import type { InvoiceTotals } from './invoice-totals-bar';

/** Mirror of the API's `computeFinancials`, so both agree on the arithmetic. */
function derive(
  lines: ApiLine[],
  server: ApiInvoiceDetail['financials'],
): InvoiceTotals {
  const gross = lines.reduce((sum, l) => sum + l.amount * l.quantity, 0);
  // Discounts and payments are not touched by editing lines, so they come
  // from the server untouched; only the billed side is recomputed here.
  const discounts = server.discounts;
  const paid = server.paid;
  const net = Math.max(0, gross - discounts);
  return {
    gross,
    discounts,
    net,
    paid,
    credited: server.credited,
    balance: Math.max(0, net - paid),
    overpaid: Math.max(0, paid - net),
  };
}

/** The draft's own details, as edited on screen. */
export interface InvoiceHeader {
  termName: string | null;
  termYear: number | null;
  termCycle: number | null;
  dueDate: string | null;
  notes: string | null;
}

function headerOf(invoice: ApiInvoiceDetail): InvoiceHeader {
  return {
    termName: invoice.termName ?? null,
    termYear: invoice.termYear ?? null,
    termCycle: invoice.termCycle ?? null,
    dueDate: invoice.dueDate ?? null,
    notes: invoice.notes ?? null,
  };
}

export function useOptimisticInvoice(invoice: ApiInvoiceDetail) {
  const [lines, setLines] = React.useState<ApiLine[]>(invoice.lines);
  const [header, setHeader] = React.useState<InvoiceHeader>(() =>
    headerOf(invoice),
  );

  // The server has spoken — adopt it. This runs after any refresh we do ask
  // for (issuing, adjustments) and after another tab's navigation, so the
  // local copy can never drift permanently.
  React.useEffect(() => {
    setLines(invoice.lines);
  }, [invoice.lines]);

  // Depends on the whole prop deliberately. Its identity changes only when the
  // server sends a new payload — a navigation or an explicit refresh — not on
  // every local re-render, so adopting it wholesale cannot clobber an edit in
  // progress.
  React.useEffect(() => {
    setHeader(headerOf(invoice));
  }, [invoice]);

  const financials = React.useMemo(
    () => derive(lines, invoice.financials),
    [lines, invoice.financials],
  );

  /**
   * Show it, write it, and put it back if the write fails.
   *
   * `rollback` is captured from the state at call time rather than read later,
   * so a failure restores what was on screen before this change and not
   * whatever a subsequent edit left behind.
   */
  const optimistic = React.useCallback(
    async (
      next: (current: ApiLine[]) => ApiLine[],
      write: () => Promise<unknown>,
      failure: string,
    ) => {
      let rollback: ApiLine[] = [];
      setLines((current) => {
        rollback = current;
        return next(current);
      });
      try {
        return await write();
      } catch (e) {
        setLines(rollback);
        toast.error(e instanceof Error ? e.message : failure);
        return null;
      }
    },
    [],
  );

  /**
   * Apply a header edit on screen, then write it. The page header's term and
   * due-date pills read from this, so they move with the field instead of
   * waiting on a round trip that used to re-fetch the entire route.
   */
  const saveHeader = React.useCallback(
    async <K extends keyof InvoiceHeader>(
      field: K,
      value: InvoiceHeader[K],
      write: () => Promise<unknown>,
      failure: string,
    ) => {
      let rollback: InvoiceHeader | null = null;
      setHeader((current) => {
        rollback = current;
        return { ...current, [field]: value };
      });
      try {
        await write();
        return true;
      } catch (e) {
        if (rollback) setHeader(rollback);
        toast.error(e instanceof Error ? e.message : failure);
        return false;
      }
    },
    [],
  );

  return { lines, setLines, financials, optimistic, header, saveHeader };
}
