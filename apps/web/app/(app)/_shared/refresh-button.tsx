'use client';

/* ============================================================
   RefreshButton — manual "check for fresh data" control.

   Pairs with the SWR-backed hooks: `onRefresh` triggers a
   revalidation and `refreshing` spins the icon while it's in
   flight. Icon-only by default (compact for a page header); pass
   `label` to show text alongside it.
   ============================================================ */

import { RefreshCw } from 'lucide-react';

import { Button } from '@workspace/ui/components/button';
import { cn } from '@workspace/ui/lib/utils';

interface RefreshButtonProps {
  onRefresh: () => void;
  refreshing?: boolean;
  /** Optional visible label; when omitted the button is icon-only. */
  label?: string;
  className?: string;
}

export function RefreshButton({
  onRefresh,
  refreshing = false,
  label,
  className,
}: RefreshButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      size={label ? 'sm' : 'icon-sm'}
      onClick={onRefresh}
      disabled={refreshing}
      aria-label={label ?? 'Refresh data'}
      // Promote the BUTTON to its own compositor layer (not the icon — the
      // spin animation owns the icon's `transform`, so a GPU hint there is
      // overwritten). On iOS PWAs the spinning RefreshCw otherwise left a
      // half-frame ghost that read as a second, superimposed icon in the box.
      className={cn('transform-gpu [backface-visibility:hidden]', className)}
    >
      <RefreshCw className={cn(refreshing && 'animate-spin')} aria-hidden />
      {label}
    </Button>
  );
}
