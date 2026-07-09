/**
 * Anthropic Service
 *
 * Thin injectable wrapper around @anthropic-ai/sdk — the ONLY file in the
 * codebase that imports the SDK. Exposes the client through typed helpers
 * (one-shot message, streaming) and typed errors so callers never handle
 * raw SDK error shapes.
 */
import { Inject, Injectable } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { aiConfig } from '../config/ai.config';
import type { AiConfig } from '../config/ai.config';
import type {
  LlmAssistantTurn,
  LlmChatRequest,
  LlmContentPart,
  LlmProvider,
  LlmStopReason,
  LlmStreamEvent,
} from '../llm/llm.types';

/**
 * Thrown when an AI feature is invoked while AI is disabled
 * (AI_ENABLED=false) or unconfigured (no ANTHROPIC_API_KEY).
 */
export class AiUnavailableError extends Error {
  constructor(message = 'AI features are not available') {
    super(message);
    this.name = 'AiUnavailableError';
  }
}

/**
 * Thrown when a request to the Anthropic API fails.
 * Carries the HTTP status when the API returned one.
 */
export class AnthropicRequestError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'AnthropicRequestError';
  }
}

@Injectable()
export class AnthropicService implements LlmProvider {
  private client: Anthropic | null = null;

  readonly providerName = 'anthropic';

  constructor(@Inject(aiConfig.KEY) private readonly config: AiConfig) {}

  /** Kill switch + key presence — callers should check before invoking AI. */
  get isAvailable(): boolean {
    return this.config.AI_ENABLED && Boolean(this.config.ANTHROPIC_API_KEY);
  }

  get isEnabled(): boolean {
    return this.config.AI_ENABLED;
  }

  get model(): string {
    return this.config.AI_MODEL;
  }

  get maxTokens(): number {
    return this.config.AI_MAX_TOKENS;
  }

  private getClient(): Anthropic {
    if (!this.isAvailable) {
      throw new AiUnavailableError(
        this.config.AI_ENABLED
          ? 'ANTHROPIC_API_KEY is not configured'
          : 'AI features are disabled (AI_ENABLED=false)',
      );
    }
    if (!this.client) {
      this.client = new Anthropic({ apiKey: this.config.ANTHROPIC_API_KEY });
    }
    return this.client;
  }

  /**
   * One-shot (non-streaming) message call. Model and max_tokens default
   * from config but can be overridden per call.
   */
  async createMessage(
    params: Omit<Anthropic.MessageCreateParamsNonStreaming, 'model' | 'max_tokens'> & {
      model?: string;
      max_tokens?: number;
    },
  ): Promise<Anthropic.Message> {
    try {
      return await this.getClient().messages.create({
        model: this.config.AI_MODEL,
        max_tokens: this.config.AI_MAX_TOKENS,
        ...params,
      });
    } catch (error) {
      throw this.toTypedError(error);
    }
  }

  /**
   * Streaming message call — returns the SDK MessageStream (async iterable
   * of events, plus finalMessage()). Errors surfaced on the stream keep the
   * SDK shape; callers should map them with toTypedError if needed.
   */
  streamMessage(
    params: Omit<Anthropic.MessageStreamParams, 'model' | 'max_tokens'> & {
      model?: string;
      max_tokens?: number;
    },
  ) {
    return this.getClient().messages.stream({
      model: this.config.AI_MODEL,
      max_tokens: this.config.AI_MAX_TOKENS,
      ...params,
    });
  }

  /**
   * Minimal round-trip against the live API — proves the key/model work.
   * Used by GET /ai/health.
   */
  async ping(): Promise<{ ok: true; model: string; latencyMs: number }> {
    const startedAt = Date.now();
    await this.createMessage({
      max_tokens: 256,
      messages: [{ role: 'user', content: 'Reply with the single word: pong' }],
    });
    return {
      ok: true,
      model: this.config.AI_MODEL,
      latencyMs: Date.now() - startedAt,
    };
  }

  /**
   * LlmProvider implementation: stream one assistant turn. Adaptive thinking
   * is always on (tech decision in docs/ai-integration-plan.md); thinking
   * blocks come back as opaque parts so the tool loop can replay them
   * verbatim without knowing SDK shapes.
   */
  async *stream(request: LlmChatRequest): AsyncGenerator<LlmStreamEvent> {
    const startedAt = Date.now();
    const stream = this.getClient().messages.stream(
      this.toSdkParams(request),
    );

    try {
      for await (const event of stream) {
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta'
        ) {
          yield { type: 'text_delta', text: event.delta.text };
        }
      }
      const final = await stream.finalMessage();
      yield {
        type: 'turn_complete',
        turn: this.toTurn(final, Date.now() - startedAt),
      };
    } catch (error) {
      throw this.toTypedError(error);
    }
  }

  private toSdkParams(
    request: LlmChatRequest,
  ): Anthropic.MessageStreamParams {
    return {
      model: request.model,
      max_tokens: request.maxTokens,
      // Adaptive thinking is the default (analytics tool loop). `'none'` omits
      // it — grounded RAG doesn't need it, and Haiku rejects adaptive thinking.
      ...(request.thinking === 'none'
        ? {}
        : { thinking: { type: 'adaptive' as const } }),
      system: request.system?.map((part) => ({
        type: 'text' as const,
        text: part.text,
        // Cache breakpoint = end of the frozen prefix (tools render before
        // system, so this caches tools + stable system together).
        ...(part.cache ? { cache_control: { type: 'ephemeral' as const } } : {}),
      })),
      tools: request.tools?.map((tool) => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.inputSchema as Anthropic.Tool.InputSchema,
      })),
      messages: request.messages.map((message) => ({
        role: message.role,
        content: message.content.map((part) => this.toSdkBlock(part)),
      })),
    };
  }

  private toSdkBlock(part: LlmContentPart): Anthropic.ContentBlockParam {
    switch (part.type) {
      case 'text':
        return { type: 'text', text: part.text };
      case 'tool_call':
        return {
          type: 'tool_use',
          id: part.id,
          name: part.name,
          input: part.input,
        };
      case 'tool_result':
        return {
          type: 'tool_result',
          tool_use_id: part.toolCallId,
          content: part.content,
          ...(part.isError ? { is_error: true } : {}),
        };
      case 'opaque':
        // Replayed exactly as received (thinking blocks etc.). Parts from a
        // different provider never reach us — the loop stays on one provider.
        return part.payload as Anthropic.ContentBlockParam;
    }
  }

  private toTurn(message: Anthropic.Message, latencyMs: number): LlmAssistantTurn {
    const content: LlmContentPart[] = message.content.map((block) => {
      if (block.type === 'text') {
        return { type: 'text', text: block.text };
      }
      if (block.type === 'tool_use') {
        return {
          type: 'tool_call',
          id: block.id,
          name: block.name,
          input: (block.input ?? {}) as Record<string, unknown>,
        };
      }
      return { type: 'opaque', provider: this.providerName, payload: block };
    });

    const stopReasonMap: Record<string, LlmStopReason> = {
      end_turn: 'end_turn',
      tool_use: 'tool_use',
      max_tokens: 'max_tokens',
      refusal: 'refusal',
    };

    return {
      content,
      stopReason: stopReasonMap[message.stop_reason ?? ''] ?? 'other',
      usage: {
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens,
        cacheReadInputTokens: message.usage.cache_read_input_tokens ?? 0,
        cacheCreationInputTokens:
          message.usage.cache_creation_input_tokens ?? 0,
      },
      model: message.model,
      provider: this.providerName,
      latencyMs,
    };
  }

  toTypedError(error: unknown): AiUnavailableError | AnthropicRequestError {
    if (error instanceof AiUnavailableError) {
      return error;
    }
    if (error instanceof Anthropic.APIError) {
      const status: unknown = error.status;
      return new AnthropicRequestError(
        `Anthropic API error: ${error.message}`,
        typeof status === 'number' ? status : undefined,
        error,
      );
    }
    return new AnthropicRequestError(
      `Anthropic request failed: ${error instanceof Error ? error.message : String(error)}`,
      undefined,
      error,
    );
  }
}
