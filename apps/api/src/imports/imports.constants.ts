/** Durable job types for the import pipeline (F2 / ADR-09), run on F3. */
export const IMPORT_COMMIT_JOB = 'import.commit';
export const IMPORT_RECONCILE_JOB = 'import.reconcile';

export interface ImportJobPayload {
  importJobId: string;
  actorId?: string | null;
}

/** Import lifecycle states (kept in sync with the ADR-09 pipeline). */
export const IMPORT_STATUS = {
  DRAFT: 'draft',
  UPLOADED: 'uploaded',
  MAPPED: 'mapped',
  VALIDATED: 'validated',
  DRY_RUN: 'dry_run',
  AWAITING_APPROVAL: 'awaiting_approval',
  APPROVED: 'approved',
  COMMITTED: 'committed',
  RECONCILED: 'reconciled',
  FAILED: 'failed',
  ROLLED_BACK: 'rolled_back',
} as const;

/** Target domains whose imports must be approved before commit (maker-checker). */
export const APPROVAL_REQUIRED_DOMAINS = new Set([
  'opening_debt',
  'grades',
  'finance',
]);
