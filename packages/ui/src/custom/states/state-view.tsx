'use client';

/* ============================================================
   StateView — shared scaffold for full-surface page/section states

   The single visual primitive behind EmptyState, ErrorState and
   ForbiddenState (see page-states.tsx). Renders a centered column:
   optional tone-tinted icon medallion · title · description ·
   action cluster · optional footer slot. Token-driven; no embedded
   copy. Layout is stable — the column is centered in whatever space
   the parent gives it and never reflows the surrounding chrome.
   ============================================================ */

import * as React from 'react';

import { Button } from '@workspace/ui/components/button';
import { cn } from '@workspace/ui/lib/utils';
import type {
  StateAction,
  StateTone,
} from '@workspace/ui/types/states.types';

/** Tone → medallion colour roles (icon foreground + tinted background). */
const TONE_MEDALLION: Record<StateTone, string> = {
  neutral: 'bg-accent text-muted-foreground',
  info: 'bg-info/12 text-info',
  success: 'bg-success/12 text-success',
  warning: 'bg-warning/15 text-warning',
  destructive: 'bg-destructive/12 text-destructive',
};

/** Render a StateAction as the shared Button (link when `href` is set). */
export function StateActionButton({
  action,
  fallbackVariant = 'default',
  size = 'sm',
}: {
  action: StateAction;
  fallbackVariant?: StateAction['variant'];
  size?: 'sm' | 'default';
}) {
  const variant = action.variant ?? fallbackVariant;
  const content = (
    <>
      {action.icon}
      {action.label}
    </>
  );

  if (action.href) {
    return (
      <Button asChild variant={variant} size={size} aria-label={action.ariaLabel}>
        <a href={action.href} onClick={action.onClick}>
          {content}
        </a>
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      disabled={action.disabled}
      onClick={action.onClick}
      aria-label={action.ariaLabel}
    >
      {content}
    </Button>
  );
}

export interface StateViewProps {
  /** Primary message — always consumer-supplied. */
  title: string;
  /** Optional supporting sentence beneath the title. */
  description?: React.ReactNode;
  /** Decorative leading icon shown in the tone medallion. */
  icon?: React.ReactNode;
  /** Colour tone for the medallion. Defaults to `neutral`. */
  tone?: StateTone;
  /** Primary call-to-action (rendered as a solid button). */
  primaryAction?: StateAction;
  /** Secondary call-to-action (rendered as an outline button). */
  secondaryAction?: StateAction;
  /** Extra content below the actions (e.g. support link, details). */
  footer?: React.ReactNode;
  /**
   * Tighter spacing for in-card / section use. Full spacing (default)
   * suits an empty page body.
   */
  compact?: boolean;
  /** ARIA role, e.g. `alert` for errors, `status` for transient states. */
  role?: React.AriaRole;
  /** ARIA live politeness when the state appears dynamically. */
  'aria-live'?: React.AriaAttributes['aria-live'];
  className?: string;
}

export function StateView({
  title,
  description,
  icon,
  tone = 'neutral',
  primaryAction,
  secondaryAction,
  footer,
  compact = false,
  role,
  className,
  ...aria
}: StateViewProps) {
  const titleId = React.useId();
  const descId = React.useId();
  const hasActions = Boolean(primaryAction || secondaryAction);

  return (
    <div
      data-slot="state-view"
      role={role}
      aria-live={aria['aria-live']}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      className={cn(
        'mx-auto flex w-full max-w-md flex-col items-center justify-center text-center',
        compact ? 'gap-3 py-8' : 'gap-4 py-14',
        className,
      )}
    >
      {icon ? (
        <div
          aria-hidden
          className={cn(
            'flex shrink-0 items-center justify-center rounded-full [&_svg]:size-1/2',
            compact ? 'size-11' : 'size-14',
            TONE_MEDALLION[tone],
          )}
        >
          {icon}
        </div>
      ) : null}

      <div className={cn('flex flex-col', compact ? 'gap-1' : 'gap-1.5')}>
        <h2
          id={titleId}
          className={cn(
            'font-bold tracking-[-0.01em] text-foreground text-balance',
            compact ? 'text-base' : 'text-lg',
          )}
        >
          {title}
        </h2>
        {description ? (
          <p
            id={descId}
            className="text-sm leading-relaxed text-muted-foreground text-pretty"
          >
            {description}
          </p>
        ) : null}
      </div>

      {hasActions ? (
        <div className="mt-1 flex flex-wrap items-center justify-center gap-2.5">
          {primaryAction ? (
            <StateActionButton action={primaryAction} fallbackVariant="default" />
          ) : null}
          {secondaryAction ? (
            <StateActionButton
              action={secondaryAction}
              fallbackVariant="outline"
            />
          ) : null}
        </div>
      ) : null}

      {footer ? (
        <div className="mt-1 text-xs text-muted-foreground">{footer}</div>
      ) : null}
    </div>
  );
}
