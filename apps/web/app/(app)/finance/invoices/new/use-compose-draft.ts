'use client';

/* ============================================================
   The unsaved invoice, held in the browser

   A new invoice writes nothing until the bursar commits it, so between
   choosing a student and pressing Save it exists only here. "Only here" must
   still survive a reload: a bill half-composed is real work, and losing it to
   a stray refresh or a crashed tab is exactly the failure a drawer was chosen
   to avoid in the first place.

   It is deliberately per-browser. With no row on the server there is nowhere
   else for it to live — compose on a laptop and it is not on the phone. That
   is the price of not writing before the permission gate, and it is the trade
   the gate is worth.
   ============================================================ */

import * as React from 'react';

/** Bump when the shape changes, so an old draft is dropped, not misread. */
const STORAGE_KEY = 'swe.invoice-compose.v1';

export interface ComposeLine {
  /** Local identity — these rows have no server id until the invoice is saved. */
  key: string;
  feeItemId: string;
  /** Kobo. Resolved from the catalogue for a fixed item; typed for an open one. */
  amount: number;
  quantity: number;
  description?: string;
}

export interface ComposeDraft {
  studentId: string | null;
  termName: string;
  termYear: string;
  termCycle: string;
  dueDate: string;
  notes: string;
  lines: ComposeLine[];
  /** When it was last touched — shown when offering to resume. */
  savedAt: string | null;
}

export const EMPTY_DRAFT: ComposeDraft = {
  studentId: null,
  termName: '',
  termYear: '',
  termCycle: '',
  dueDate: '',
  notes: '',
  lines: [],
  savedAt: null,
};

/** Is there anything here a person would be annoyed to lose? */
export function isWorthKeeping(draft: ComposeDraft): boolean {
  return (
    draft.lines.length > 0 ||
    draft.termName.trim() !== '' ||
    draft.notes.trim() !== ''
  );
}

function read(): ComposeDraft | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ComposeDraft>;
    // Anything from an older or hand-edited entry is treated as absent rather
    // than trusted into the form.
    if (!Array.isArray(parsed.lines)) return null;
    return { ...EMPTY_DRAFT, ...parsed, lines: parsed.lines };
  } catch {
    return null;
  }
}

/**
 * The draft plus its persistence.
 *
 * Restoring is NOT automatic: `stored` is handed back untouched so the caller
 * can offer it, because silently repopulating a form with work from a previous
 * sitting is how someone bills the wrong family.
 */
export function useComposeDraft() {
  const [draft, setDraft] = React.useState<ComposeDraft>(EMPTY_DRAFT);
  const [stored, setStored] = React.useState<ComposeDraft | null>(null);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    const found = read();
    if (found && isWorthKeeping(found)) setStored(found);
    setReady(true);
  }, []);

  // Persist every change. Cheap at this size, and it means the last thing
  // typed is the last thing kept.
  React.useEffect(() => {
    if (!ready) return;
    try {
      if (isWorthKeeping(draft) || draft.studentId) {
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ ...draft, savedAt: new Date().toISOString() }),
        );
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // A full or blocked store must not break composing — the invoice still
      // works, it just stops surviving a reload.
    }
  }, [draft, ready]);

  const clear = React.useCallback(() => {
    setDraft(EMPTY_DRAFT);
    setStored(null);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* nothing to undo */
    }
  }, []);

  const resume = React.useCallback(() => {
    if (stored) setDraft(stored);
    setStored(null);
  }, [stored]);

  const discardStored = React.useCallback(() => {
    setStored(null);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* nothing to undo */
    }
  }, []);

  return { draft, setDraft, ready, stored, resume, discardStored, clear };
}
