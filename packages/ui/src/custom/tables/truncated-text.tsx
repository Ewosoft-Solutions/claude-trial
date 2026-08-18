'use client';

/**
 * Single-line text that truncates to whatever width its container allows (so a
 * wider column / bigger screen shows more) and reveals the full value in a
 * tooltip on hover — but ONLY when it is actually clipped, so short values don't
 * carry a pointless tooltip. Clipping is measured from layout (scrollWidth vs
 * clientWidth) and re-checked on resize, so it stays correct as the column flexes.
 *
 * The trigger element is ALWAYS the same `<span>` (only the portaled tooltip
 * content is toggled) — wrapping/unwrapping it based on the measurement would
 * reflow the very element being observed and fight the ResizeObserver.
 *
 * Give the cell/wrapper a constrained (ideally responsive) width — e.g.
 * `max-w-[16rem] lg:max-w-[26rem]` plus `min-w-0` — and drop this in for the
 * value. Inside a `DirectoryTable` you do NOT need to do that by hand: set
 * `truncate` on the column and the table applies both halves for you.
 *
 * Lives in `packages/ui` (not the web app) so the shared table components can
 * use it — `packages/ui` cannot import from `apps/web`.
 */
import * as React from 'react';

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@workspace/ui/components/tooltip';
import { cn } from '@workspace/ui/lib/utils';

export interface TruncatedTextProps {
  /**
   * The value to show (and, by default, the tooltip content). Prefer this for
   * plain strings — it gives the tooltip an exact value with no DOM read.
   */
  text?: string;
  /**
   * Arbitrary cell content to clamp instead of `text`. The tooltip falls back
   * to the rendered `textContent`, so composed cells (icon + value, a
   * `MaskedValue`, …) still get a useful hover without threading a string
   * through every call site.
   */
  children?: React.ReactNode;
  className?: string;
  /** Override the tooltip content (defaults to `text`, else the text content). */
  tooltip?: React.ReactNode;
}

export function TruncatedText({
  text,
  children,
  className,
  tooltip,
}: TruncatedTextProps) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const [clipped, setClipped] = React.useState(false);
  // Only read from the DOM when no explicit string was supplied.
  const [readText, setReadText] = React.useState('');

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      // Read the value FIRST: it needs no layout, and the tooltip falls back to
      // it. Behind the zero-width guard below it would never populate for a
      // cell that starts hidden (or in a non-layout environment).
      setReadText((prev) => {
        const next = el.textContent ?? '';
        return prev === next ? prev : next;
      });
      // Ignore pre-layout / hidden passes so a transient 0-width never
      // flip-flops the CLIPPING result.
      if (el.clientWidth === 0) return;
      // A composed cell (two stacked lines, icon + value, …) clips on its own
      // descendants rather than on this wrapper, which then measures as
      // un-clipped. Check both, or such a cell would silently lose its tooltip.
      const overflows = (node: Element) =>
        node.scrollWidth - node.clientWidth > 1;
      setClipped(
        overflows(el) || Array.from(el.querySelectorAll('*')).some(overflows),
      );
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [text, children]);

  const content = children ?? text;
  const hoverValue = tooltip ?? text ?? readText;

  return (
    <Tooltip open={clipped ? undefined : false}>
      <TooltipTrigger asChild>
        <span
          ref={ref}
          className={cn(
            // `truncate` on this wrapper only ellipsises ITS OWN inline text, so
            // a composed cell would hard-cut with no ellipsis. Pushing the same
            // clamp onto descendants makes each stacked line ellipsise instead;
            // `min-w-0` lets flex/grid children shrink below their content.
            'block min-w-0 truncate [&_*]:min-w-0 [&_*]:truncate',
            className,
          )}
        >
          {content}
        </span>
      </TooltipTrigger>
      {clipped ? (
        <TooltipContent className="max-w-[min(90vw,32rem)] break-all">
          {hoverValue}
        </TooltipContent>
      ) : null}
    </Tooltip>
  );
}
