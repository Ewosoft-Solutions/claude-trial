import type { ScopeDescriptor } from '../../auth/services/access-scope.service';

/** Who is acting on a result cycle + their authority (for maker-checker + scope). */
export interface ResultActor {
  userId: string;
  clearanceLevel: number;
  grantScope?: ScopeDescriptor | null;
}

/** Statuses a result cycle moves through (ADR-04 lifecycle). */
export const RESULT_CYCLE_STATUSES = [
  'draft',
  'entry_open',
  'entry_closed',
  'moderation',
  'pending_approval',
  'published',
  'archived',
  'cancelled',
] as const;
export type ResultCycleStatus = (typeof RESULT_CYCLE_STATUSES)[number];

export const RESULT_PUBLISH_OP = 'academics.results.publish';
export const RESULT_AMEND_OP = 'academics.results.amend';
