/** Durable job types for WB4 results (ADR-04), run on the F3 substrate. */
export const RESULT_ARTIFACTS_JOB = 'results.artifacts';

/**
 * Render + store the report-card/broadsheet artifacts and notify guardians for
 * ONE section of a publication. Fanning out per section keeps each job's
 * transaction small (a section's worth of storage writes), off the user's
 * publish request, and independently retryable — the ADR-04 "publish runs as an
 * ADR-06 job" path.
 */
export interface ResultArtifactsPayload {
  publicationId: string;
  classSectionId: string;
}
