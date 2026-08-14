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
 * `max-w-[16rem] lg:max-w-[26rem]` plus `min-w-0` — and drop this in for the value.
 */
import * as React from 'react';

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@workspace/ui/components/tooltip';
import { cn } from '@workspace/ui/lib/utils';

export function TruncatedText({
  text,
  className,
  tooltip,
}: {
  /** The value to show (and, by default, the tooltip content). */
  text: string;
  className?: string;
  /** Override the tooltip content (defaults to `text`). */
  tooltip?: React.ReactNode;
}) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const [clipped, setClipped] = React.useState(false);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      // Ignore pre-layout / hidden passes so a transient 0-width never
      // flip-flops the result.
      if (el.clientWidth === 0) return;
      setClipped(el.scrollWidth - el.clientWidth > 1);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [text]);

  return (
    <Tooltip open={clipped ? undefined : false}>
      <TooltipTrigger asChild>
        <span ref={ref} className={cn('block truncate', className)}>
          {text}
        </span>
      </TooltipTrigger>
      {clipped ? (
        <TooltipContent className="max-w-[min(90vw,32rem)] break-all">
          {tooltip ?? text}
        </TooltipContent>
      ) : null}
    </Tooltip>
  );
}
