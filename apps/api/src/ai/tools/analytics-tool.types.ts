/**
 * Analytics AI tool contract (Step 2, docs/ai-integration-plan.md).
 *
 * Each tool delegates to an existing permission-gated NestJS read service —
 * never raw SQL — and declares the permission + minimum clearance it
 * requires. The tool loop consults AIMediatorService/PermissionService with
 * these declarations BEFORE executing, and refuses with the requirements'
 * "insufficient clearance" shape when the caller doesn't qualify.
 */
import type { LlmToolDefinition } from '../llm/llm.types';

/** Who is asking — resolved once per chat request from the access token. */
export interface AnalyticsToolContext {
  tenantId: string;
  userId: string;
  profileId: string;
}

export interface AnalyticsTool {
  definition: LlmToolDefinition;
  /** Seed-catalog permission the caller must hold (the `hr.view` lesson). */
  requiredPermission: string;
  /** Minimum clearance level (0–10) to execute this tool. */
  minClearance: number;
  /**
   * Runs inside a tenant RLS scope opened by the caller (tool loop), so the
   * delegated services read through the scoped client.
   */
  execute(
    context: AnalyticsToolContext,
    input: Record<string, unknown>,
  ): Promise<unknown>;
}
