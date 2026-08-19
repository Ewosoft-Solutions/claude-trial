/* ============================================================
   Dot — the separator between two facts on one line

   "Student · P5", "Invoice · Paid", "Class 5A · Guardian Ada": one
   line carrying two or three independent facts, divided by a mark.

   The mark is DRAWN, not typed. A MIDDLE DOT glyph at 12-13px is barely
   two pixels of ink and all but vanishes between two words, so the line
   reads as one run-on phrase rather than separate facts. Scaling the
   glyph up inherits whatever vertical position and weight the font
   gives it — which differs per face and sits noticeably low in the
   product's — where a drawn circle has an exact size and centres on the
   text's optical middle via `align-middle`.

   It takes its colour from the text it sits in (`bg-current`), so it
   works in muted captions, tonal badges and full-contrast body copy
   without a per-context override, and it never changes the line's
   height.

   It is punctuation, not content: `aria-hidden`, so assistive tech
   reads the facts and not the mark between them. Which is also why a
   dot inside an accessible NAME (`aria-label`, `getRowLabel`, a
   `description` field that feeds one) must stay a plain `·` character —
   those are strings, and a decorative mark does not belong in them.

   Presentational and server-safe (no hooks).
   ============================================================ */

import * as React from 'react';

import { cn } from '@workspace/ui/lib/utils';

export interface DotProps extends React.ComponentProps<'span'> {
  /**
   * Tighten the surrounding space. Defaults to the normal `mx-1.5`, which
   * reads as a word gap either side; `tight` halves it for dense rows.
   */
  tight?: boolean;
}

export function Dot({ className, tight = false, ...props }: DotProps) {
  return (
    <span
      aria-hidden
      data-slot="dot"
      className={cn(
        'inline-block size-[3px] shrink-0 rounded-full bg-current align-middle',
        tight ? 'mx-1' : 'mx-1.5',
        className,
      )}
      {...props}
    />
  );
}

export interface SeparatedProps {
  /**
   * A string whose parts are already joined with `' · '`. Empty parts are
   * dropped, so `['a', null].filter(Boolean).join(' · ')` needs no guard at
   * the call site.
   */
  text: string;
  /** Tighten the space around each dot. */
  tight?: boolean;
}

/**
 * Renders a `' · '`-joined string with drawn {@link Dot}s in place of the
 * glyphs — the migration path for the many call sites that already build
 * their label by joining parts, without restructuring each one into JSX.
 *
 * Prefer composing `<Dot />` directly when the parts are already separate
 * nodes; reach for this when the value arrives as one joined string.
 */
export function Separated({ text, tight = false }: SeparatedProps) {
  const parts = text.split(' · ').filter(Boolean);
  return (
    <>
      {parts.map((part, i) => (
        <React.Fragment key={`${part}-${i}`}>
          {i > 0 ? <Dot tight={tight} /> : null}
          {part}
        </React.Fragment>
      ))}
    </>
  );
}
