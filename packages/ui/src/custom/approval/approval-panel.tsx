'use client';

/* ============================================================
   ApprovalPanel — the maker-checker surface (F8)

   A high-risk change is a request, not a silent mutation: this
   is the checker's view of a MakerCheckerRequest. It shows who
   asked, why, and exactly what would change (before → after),
   then offers Approve / Reject. Two guardrails are first-class:
   a SEPARATION-OF-DUTIES block when the checker is the maker
   (approve is disabled with an explanation), and a STEP-UP
   notice when the policy requires re-authentication. Controlled:
   the host performs the decision + step-up.
   ============================================================ */

import * as React from 'react';
import { AlertTriangle, Check, ShieldCheck, X } from 'lucide-react';

import { cn } from '@workspace/ui/lib/utils';
import { Button } from '@workspace/ui/components/button';
import { StatusBadge } from '@workspace/ui/custom/data-display/status-badge';
import type {
  ApprovalField,
  ApprovalRequestMeta,
} from '@workspace/ui/types/patterns.types';

export interface ApprovalPanelProps {
  request: ApprovalRequestMeta;
  /** What the request would change, before → after. */
  fields?: ApprovalField[];
  /** Whether this reviewer is allowed to approve at all (permission/clearance). */
  canApprove?: boolean;
  /** The reviewer is the requester → separation-of-duties conflict. */
  isSelfRequest?: boolean;
  /** Approving requires a step-up (re-auth / MFA). */
  stepUpRequired?: boolean;
  onApprove?: () => void;
  onReject?: () => void;
  className?: string;
}

export function ApprovalPanel({
  request,
  fields,
  canApprove = true,
  isSelfRequest = false,
  stepUpRequired = false,
  onApprove,
  onReject,
  className,
}: ApprovalPanelProps) {
  const approveBlocked = isSelfRequest || !canApprove;

  return (
    <div
      data-slot="approval"
      className={cn(
        'flex min-w-0 flex-col gap-3 rounded-[var(--radius-lg)] border border-border bg-card p-4',
        className,
      )}
    >
      <div className="flex min-w-0 flex-wrap items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h3 className="min-w-0 font-display text-[calc(17px*var(--font-scale))] font-semibold break-words text-foreground">
            {request.title}
          </h3>
          <p className="text-[calc(12px*var(--font-scale))] text-muted-foreground">
            Requested by{' '}
            <span className="font-medium text-foreground">
              {request.requestedBy}
            </span>
            {request.requestedAt ? ` · ${request.requestedAt}` : ''}
          </p>
        </div>
        <StatusBadge tone={request.riskTone ?? 'warning'} dot>
          {request.riskLabel ?? 'High-risk'}
        </StatusBadge>
      </div>

      {request.reason ? (
        <p className="rounded-[var(--radius-sm)] bg-secondary/60 px-3 py-2 text-[calc(12.5px*var(--font-scale))] text-foreground">
          <span className="font-semibold">Reason: </span>
          {request.reason}
        </p>
      ) : null}

      {fields?.length ? (
        <dl className="flex flex-col divide-y divide-border overflow-hidden rounded-[var(--radius-md)] border border-border">
          {fields.map((field) => (
            <div
              key={field.key}
              className="grid gap-1 px-3 py-2 text-[calc(12.5px*var(--font-scale))] @sm/approval:grid-cols-[10rem_1fr]"
            >
              <dt className="font-medium text-muted-foreground">
                {field.label}
              </dt>
              <dd className="flex min-w-0 flex-wrap items-center gap-2">
                {/* sr-only "from … to …" so the before→after relationship is
                    announced (the line-through + arrow are visual-only). */}
                <span className="sr-only">from </span>
                <span className="text-muted-foreground line-through decoration-muted-foreground/50">
                  {field.before ?? '—'}
                </span>
                <span aria-hidden className="text-muted-foreground">
                  →
                </span>
                <span className="sr-only"> to </span>
                <span className="font-semibold text-foreground">
                  {field.after ?? '—'}
                </span>
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      {isSelfRequest ? (
        <Callout
          tone="warning"
          icon={<AlertTriangle className="size-4" aria-hidden />}
        >
          Separation of duties: you raised this request, so it must be approved
          by a different authorized reviewer.
        </Callout>
      ) : null}

      {stepUpRequired && !approveBlocked ? (
        <Callout
          tone="info"
          icon={<ShieldCheck className="size-4" aria-hidden />}
        >
          Approving this change requires re-authentication (step-up).
        </Callout>
      ) : null}

      <div className="flex flex-wrap justify-end gap-2 pt-1">
        <Button type="button" variant="outline" size="sm" onClick={onReject}>
          <X className="size-4" /> Reject
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={approveBlocked}
          onClick={onApprove}
        >
          <Check className="size-4" />
          {stepUpRequired ? 'Approve with step-up' : 'Approve'}
        </Button>
      </div>
    </div>
  );
}

const CALLOUT_TONE = {
  neutral: 'border-border bg-muted/40 text-muted-foreground',
  info: 'border-info/40 bg-info/10 text-info',
  success: 'border-success/40 bg-success/10 text-success',
  warning: 'border-warning/45 bg-warning/12 text-warning',
  destructive: 'border-destructive/40 bg-destructive/10 text-destructive',
} as const;

function Callout({
  tone,
  icon,
  children,
}: {
  tone: keyof typeof CALLOUT_TONE;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      role="note"
      className={cn(
        'flex items-start gap-2 rounded-[var(--radius-sm)] border px-3 py-2 text-[calc(12px*var(--font-scale))] font-medium',
        CALLOUT_TONE[tone],
      )}
    >
      <span className="mt-px shrink-0">{icon}</span>
      <span className="min-w-0 text-foreground/90">{children}</span>
    </div>
  );
}
