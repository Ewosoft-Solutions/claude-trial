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
      className={className}
    >
      <RefreshCw className={cn(refreshing && 'animate-spin')} aria-hidden />
      {label}
    </Button>
  );
}
