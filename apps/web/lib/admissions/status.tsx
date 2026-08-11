/**
 * Admissions status vocabulary — the SINGLE source of truth for stage /
 * decision / requirement colours, labels, ordering and gating. Every admissions
 * surface (the internal list, drawer and detail page, and the public applicant
 * portal) renders from here, so a change to a colour or a label cascades to all
 * of them and they can never drift apart again.
 *
 * Dependency-free + server-safe: it imports only the presentational StatusBadge,
 * so the public portal can use it without coupling to the authed app.
 */
import * as React from 'react';

import { StatusBadge } from '@workspace/ui/custom/data-display/status-badge';
import type { StatusTone } from '@workspace/ui/types/states.types';

// ---- Application stage ----------------------------------------------------

/** The WB3 stage machine, in pipeline order. */
export const STAGE_ORDER = [
  'enquiry',
  'applied',
  'screening',
  'interview',
  'offer',
  'accepted',
  'enrolled',
  'rejected',
  'withdrawn',
] as const;

/**
 * Progressive palette: a distinct hue per stage so the pipeline reads as a
 * progression — cool (received) → committed → warm (offer) → success — ending
 * clearly at success (enrolled = green) with a clear negative (rejected = red).
 * No two active stages share a colour.
 */
export const STAGE_TONE: Record<string, StatusTone> = {
  enquiry: 'neutral',
  applied: 'blue',
  screening: 'violet',
  interview: 'info',
  offer: 'warning',
  accepted: 'teal',
  enrolled: 'success',
  rejected: 'destructive',
  withdrawn: 'neutral',
  // Legacy pre-WB3 stage strings still present in older seed/data — aliased to
  // canonical hues so they never fall through to a pale neutral fallback.
  application: 'blue',
  decision: 'warning',
};

/** Staff-facing stage labels (capitalised). */
export const STAGE_LABEL: Record<string, string> = {
  enquiry: 'Enquiry',
  applied: 'Applied',
  screening: 'Screening',
  interview: 'Interview',
  offer: 'Offer',
  accepted: 'Accepted',
  enrolled: 'Enrolled',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
  application: 'Application',
  decision: 'Decision',
};

/** Applicant-facing stage labels — friendlier copy for the public portal. */
export const STAGE_APPLICANT_LABEL: Record<string, string> = {
  enquiry: 'Enquiry',
  applied: 'Application received',
  screening: 'Under review',
  interview: 'Assessment / interview',
  offer: 'Offer made',
  accepted: 'Offer accepted',
  enrolled: 'Enrolled',
  rejected: 'Not successful',
  withdrawn: 'Withdrawn',
  application: 'Application received',
  decision: 'Decision pending',
};

// ---- Decision -------------------------------------------------------------

export const DECISION_TONE: Record<string, StatusTone> = {
  pending: 'warning', // amber — matches "pending/attention" elsewhere
  accepted: 'success',
  waitlisted: 'teal', // cyan — distinct from amber pending
  rejected: 'destructive',
};

export const DECISION_LABEL: Record<string, string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  waitlisted: 'Waitlisted',
  rejected: 'Rejected',
};

// ---- Requirement status + collect stage -----------------------------------

export const REQUIREMENT_STATUS_TONE: Record<string, StatusTone> = {
  pending: 'warning',
  provided: 'success',
  waived: 'neutral',
};

/** Staff-facing collect-stage labels. */
export const COLLECT_STAGE_LABEL: Record<string, string> = {
  application: 'At application',
  offer: 'On offer',
  acceptance: 'On acceptance',
  enrolment: 'On enrolment',
};

/** Applicant-facing collect-stage labels. */
export const COLLECT_STAGE_APPLICANT_LABEL: Record<string, string> = {
  application: 'Now',
  offer: 'After an offer',
  acceptance: 'After you accept',
  enrolment: 'On enrolment',
};

// ---- Gating ---------------------------------------------------------------
// A requirement is only actionable once the application has reached the stage
// that its collect-stage belongs to — so an applicant is never asked to upload
// (say) acceptance paperwork before they've been offered a place. Nothing new
// unlocks once an application is rejected or withdrawn.

const STAGE_RANK: Record<string, number> = {
  rejected: -1,
  withdrawn: -1,
  enquiry: 0,
  applied: 1,
  screening: 2,
  interview: 3,
  offer: 4,
  accepted: 5,
  enrolled: 6,
  // Legacy aliases (see STAGE_TONE).
  application: 1,
  decision: 4,
};

const COLLECT_UNLOCK_RANK: Record<string, number> = {
  application: 1, // available from the moment an application exists
  offer: 4, // only once an offer has been made
  acceptance: 5, // only once the applicant has accepted
  enrolment: 5, // acceptance → enrolment paperwork
};

/** Is a requirement (by its collect stage) actionable at the current stage? */
export function isRequirementUnlocked(
  collectStage: string,
  currentStage: string,
): boolean {
  return (
    (STAGE_RANK[currentStage] ?? 0) >= (COLLECT_UNLOCK_RANK[collectStage] ?? 99)
  );
}

// ---- Helpers + components -------------------------------------------------

export function titleCase(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/** The one badge for an application stage — colour + label from the maps above. */
export function StageBadge({
  stage,
  applicant = false,
  className,
}: {
  stage: string;
  /** Use the friendlier applicant-facing label (public portal). */
  applicant?: boolean;
  className?: string;
}) {
  const label = applicant
    ? (STAGE_APPLICANT_LABEL[stage] ?? titleCase(stage))
    : (STAGE_LABEL[stage] ?? titleCase(stage));
  return (
    <StatusBadge tone={STAGE_TONE[stage] ?? 'neutral'} className={className}>
      {label}
    </StatusBadge>
  );
}

/** The one badge for an admission decision — always carries a leading dot so it
 * reads as distinct from the stage badge. */
export function DecisionBadge({
  decision,
  className,
}: {
  decision: string;
  className?: string;
}) {
  return (
    <StatusBadge
      tone={DECISION_TONE[decision] ?? 'neutral'}
      dot
      className={className}
    >
      {DECISION_LABEL[decision] ?? titleCase(decision)}
    </StatusBadge>
  );
}

/** The one badge for a requirement's fulfilment status. */
export function RequirementStatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  return (
    <StatusBadge
      tone={REQUIREMENT_STATUS_TONE[status] ?? 'neutral'}
      className={className}
    >
      {titleCase(status)}
    </StatusBadge>
  );
}
