'use client';

/* ============================================================
   NoticeBanner — inline, full-width status strip

   A non-blocking banner pinned above a surface to flag a
   persistent condition (offline, read-only, degraded, info).
   Unlike the full-surface states it does NOT replace content —
   the page still renders beneath it. Token-driven tones, optional
   icon, optional trailing action, optional dismiss.

   Presets:
   - OfflineBanner   → working offline / reconnecting (warning)
   - ReadOnlyBanner  → viewing only, edits disabled (info)
   ============================================================ */

import * as React from 'react';
import { CloudOff, Lock, X } from 'lucide-react';

import { cn } from '@workspace/ui/lib/utils';
import type { StateAction, StateTone } from '@workspace/ui/types/states.types';
import { StateActionButton } from '@workspace/ui/custom/states/state-view';

/** Tone → banner surface colour roles (tinted bg · border · text). */
const TONE_BANNER: Record<StateTone, string> = {
  neutral: 'bg-secondary text-secondary-foreground border-border',
  info: 'bg-info/10 text-foreground border-info/30 [&_[data-slot=notice-icon]]:text-info',
  success:
    'bg-success/10 text-foreground border-success/30 [&_[data-slot=notice-icon]]:text-success',
  warning:
    'bg-warning/12 text-foreground border-warning/35 [&_[data-slot=notice-icon]]:text-warning',
  destructive:
    'bg-destructive/10 text-foreground border-destructive/30 [&_[data-slot=notice-icon]]:text-destructive',
};

export interface NoticeBannerProps {
  /** Main message — consumer-supplied. */
  title: React.ReactNode;
  /** Optional supporting detail rendered after the title. */
  description?: React.ReactNode;
  /** Leading icon. */
  icon?: React.ReactNode;
  /** Colour tone. Defaults to `info`. */
  tone?: StateTone;
  /** Trailing action (e.g. retry, learn more). */
  action?: StateAction;
  /** Show a dismiss button; called on dismiss. */
  onDismiss?: () => void;
  /** Accessible label for the dismiss button. Defaults to "Dismiss". */
  dismissLabel?: string;
  /** ARIA role. Defaults to `status` (use `alert` for urgent tones). */
  role?: React.AriaRole;
  className?: string;
}

export function NoticeBanner({
  title,
  description,
  icon,
  tone = 'info',
  action,
  onDismiss,
  dismissLabel = 'Dismiss',
  role = 'status',
  className,
}: NoticeBannerProps) {
  return (
    <div
      data-slot="notice-banner"
      role={role}
      aria-live={role === 'alert' ? 'assertive' : 'polite'}
      className={cn(
        'flex w-full flex-wrap items-center gap-x-3 gap-y-2 rounded-[var(--radius-sm)] border px-3.5 py-2.5 text-sm',
        TONE_BANNER[tone],
        className,
      )}
    >
      {icon ? (
        <span
          data-slot="notice-icon"
          aria-hidden
          className="flex shrink-0 [&_svg]:size-4"
        >
          {icon}
        </span>
      ) : null}

      <div className="min-w-0 flex-1">
        <span className="font-semibold">{title}</span>
        {description ? (
          <span className="text-muted-foreground"> — {description}</span>
        ) : null}
      </div>

      {action ? (
        <StateActionButton action={action} fallbackVariant="outline" />
      ) : null}

      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label={dismissLabel}
          className={cn(
            'flex size-7 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-muted-foreground outline-none transition-colors',
            'hover:bg-foreground/5 hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50',
          )}
        >
          <X aria-hidden className="size-4" />
        </button>
      ) : null}
    </div>
  );
}

/** Offline / reconnecting banner (warning tone). */
export function OfflineBanner({
  icon = <CloudOff />,
  tone = 'warning',
  ...props
}: NoticeBannerProps) {
  return <NoticeBanner icon={icon} tone={tone} {...props} />;
}

/** Read-only / view-only banner (info tone). */
export function ReadOnlyBanner({
  icon = <Lock />,
  tone = 'info',
  ...props
}: NoticeBannerProps) {
  return <NoticeBanner icon={icon} tone={tone} {...props} />;
}
