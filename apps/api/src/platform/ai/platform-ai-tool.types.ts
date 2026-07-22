import type { LlmToolDefinition } from '../../ai/llm/llm.types';

/** Who is asking — resolved once per request from the access token. */
export interface PlatformToolContext {
  userId: string;
  /** The caller's granted `platform.*` permissions (facets). */
  facets: Set<string>;
  clearanceLevel: number;
}

/**
 * A platform AI tool. Two invariants enforce the 0.5.8 / §7.1 hard gate:
 *
 *  1. `requiredFacet` — the platform.* permission the caller must hold. It is
 *     checked at EXECUTION time (per call), not at session start, so a session
 *     that begins in-facet can never reach a tool it lacks.
 *
 *  2. `execute` may read ONLY the aggregate platform services
 *     (PlatformAnalyticsService / PlatformRiskService / PlatformPolicyService).
 *     Those return counts/rates/distributions at the tenant level and above —
 *     never per-person rows — so the aggregate floor is structural: no tool bug
 *     can leak an individual because the data it can reach never contains one.
 *
 * Do not add a tool that reads a tenant-scoped or per-record service.
 */
export interface PlatformTool {
  definition: LlmToolDefinition;
  /** Facet the caller must hold to execute this tool, e.g. 'platform.metrics'. */
  requiredFacet: string;
  /** Reads an aggregate service. Opens its own short platform scope internally. */
  execute(
    context: PlatformToolContext,
    input: Record<string, unknown>,
  ): Promise<unknown>;
}
