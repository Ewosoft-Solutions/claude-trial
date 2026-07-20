/**
 * LlmProvider port (docs/ai-integration-plan.md → "Model & cost governance").
 *
 * A small hand-rolled interface with our own chat/stream/tool-call/usage
 * types. The tool loop, persistence, and controllers code against these
 * types and never see SDK shapes; AnthropicService is the first (and only)
 * implementation. Kept deliberately minimal — chat + streaming + tool use,
 * nothing more — so a second provider (or per-tenant BYOK) stays cheap
 * without adopting a third-party abstraction.
 */

export interface LlmTextPart {
  type: 'text';
  text: string;
}

/** The model asked us to run a tool. */
export interface LlmToolCallPart {
  type: 'tool_call';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

/** Our answer to a tool call (serialized result or error). */
export interface LlmToolResultPart {
  type: 'tool_result';
  toolCallId: string;
  content: string;
  isError?: boolean;
}

/**
 * Provider-internal content (e.g. Anthropic thinking blocks) that must be
 * replayed verbatim within the same tool loop but has no meaning to the
 * rest of the app. Only the provider that produced it interprets `payload`;
 * every other consumer treats it as opaque and every other provider drops it.
 */
export interface LlmOpaquePart {
  type: 'opaque';
  provider: string;
  payload: unknown;
}

export type LlmContentPart =
  | LlmTextPart
  | LlmToolCallPart
  | LlmToolResultPart
  | LlmOpaquePart;

export interface LlmMessage {
  role: 'user' | 'assistant';
  content: LlmContentPart[];
}

/**
 * One block of the system prompt. `cache: true` marks the end of the frozen
 * prefix (provider sets its cache breakpoint there) — everything volatile
 * (dates, per-request context) must come after the flagged block.
 */
export interface LlmSystemPart {
  text: string;
  cache?: boolean;
}

export interface LlmToolDefinition {
  name: string;
  description: string;
  /** JSON Schema for the tool input. */
  inputSchema: Record<string, unknown>;
}

/** Normalized usage accounting, persisted on every ChatMessage. */
export interface LlmUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
}

export type LlmStopReason =
  | 'end_turn'
  | 'tool_use'
  | 'max_tokens'
  | 'refusal'
  | 'other';

/** A complete assistant turn, with the metadata the caller must persist. */
export interface LlmAssistantTurn {
  content: LlmContentPart[];
  stopReason: LlmStopReason;
  usage: LlmUsage;
  model: string;
  provider: string;
  latencyMs: number;
}

export type LlmStreamEvent =
  | { type: 'text_delta'; text: string }
  | { type: 'turn_complete'; turn: LlmAssistantTurn };

export interface LlmChatRequest {
  model: string;
  maxTokens: number;
  system?: LlmSystemPart[];
  messages: LlmMessage[];
  tools?: LlmToolDefinition[];
  /**
   * Thinking mode. `'adaptive'` (the default when omitted) lets the model
   * decide how much to think — right for the analytics tool loop. `'none'`
   * omits the thinking parameter entirely, which is correct for grounded RAG
   * (the tutor) and required for models that don't accept adaptive thinking
   * (e.g. Haiku), where sending it would 400.
   */
  thinking?: 'adaptive' | 'none';
}

export interface LlmProvider {
  readonly providerName: string;
  /** False when the provider has no key or AI is globally disabled. */
  readonly isAvailable: boolean;
  /**
   * Stream one assistant turn. Yields text deltas as they arrive and ends
   * with exactly one `turn_complete` carrying the full turn + usage.
   */
  stream(request: LlmChatRequest): AsyncGenerator<LlmStreamEvent>;
}

/** Collected text of a turn (ignores tool calls and opaque parts). */
export function turnText(turn: LlmAssistantTurn): string {
  return turn.content
    .filter((part): part is LlmTextPart => part.type === 'text')
    .map((part) => part.text)
    .join('');
}

/** Tool calls requested in a turn. */
export function turnToolCalls(turn: LlmAssistantTurn): LlmToolCallPart[] {
  return turn.content.filter(
    (part): part is LlmToolCallPart => part.type === 'tool_call',
  );
}
