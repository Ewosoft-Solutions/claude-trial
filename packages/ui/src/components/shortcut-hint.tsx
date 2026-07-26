'use client';

/* ============================================================
   ShortcutHint — OS-aware keyboard shortcut chip

   Renders the platform-correct modifier: `⌘K` on macOS/iOS, `Ctrl K`
   elsewhere (Windows/Linux). SSR renders the mac default and the client
   corrects after mount (`suppressHydrationWarning`), so there is no
   hydration warning and no layout jump beyond the label swap.
   ============================================================ */

import * as React from 'react';

import { cn } from '@workspace/ui/lib/utils';

/** Detect the mac modifier post-mount. Server renders the mac default. */
function useIsMac() {
  const [isMac, setIsMac] = React.useState(true);
  React.useEffect(() => {
    const probe =
      (typeof navigator !== 'undefined' &&
        (navigator.platform || navigator.userAgent)) ||
      '';
    setIsMac(/mac|iphone|ipad|ipod/i.test(probe));
  }, []);
  return isMac;
}

export interface ShortcutHintProps
  extends Omit<React.ComponentProps<'kbd'>, 'children'> {
  /** The non-modifier key, e.g. "K" or "J". */
  keyName: string;
  /** Include the ⌘/Ctrl modifier (default) or render the bare key. */
  modifier?: boolean;
}

export function ShortcutHint({
  keyName,
  modifier = true,
  className,
  ...props
}: ShortcutHintProps) {
  const isMac = useIsMac();
  const label = !modifier
    ? keyName
    : isMac
      ? `⌘${keyName}`
      : `Ctrl ${keyName}`;

  return (
    <kbd
      suppressHydrationWarning
      className={cn(
        'inline-flex select-none items-center rounded-[5px] border border-border bg-card px-1.5 py-0.5 text-[11px] font-semibold leading-none text-muted-foreground',
        className,
      )}
      {...props}
    >
      {label}
    </kbd>
  );
}
