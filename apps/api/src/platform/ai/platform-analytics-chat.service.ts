import {
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { aiConfig, type AiConfig } from '../../ai/config/ai.config';
import { LlmProviderFactory } from '../../ai/llm/llm-provider.factory';
import {
  turnText,
  turnToolCalls,
  type LlmAssistantTurn,
  type LlmMessage,
  type LlmToolResultPart,
} from '../../ai/llm/llm.types';
import { PlatformAiToolsService } from './platform-ai-tools.service';
import type { PlatformToolContext } from './platform-ai-tool.types';

export interface PlatformChatParams {
  userId: string;
  facets: Set<string>;
  clearanceLevel: number;
  question: string;
}

export interface PlatformToolTrace {
  tool: string;
  allowed: boolean;
  error?: string;
}

export interface PlatformChatResult {
  answer: string;
  toolCalls: PlatformToolTrace[];
}

/**
 * Platform Analytics Chat (3.2).
 *
 * A cross-tenant assistant for platform operators. It reads only through the
 * facet-gated, aggregate-only tools (`PlatformAiToolsService`) — that is what
 * makes it safe to run cross-tenant (0.5.8 / §7.1 hard gate):
 *
 *  - Each tool's facet is checked at EXECUTION, against the caller's own facets.
 *    A SuperAdmin without `platform.metrics` is refused the metrics tools even
 *    if they ask for cross-tenant numbers — the model is told the data is out of
 *    reach and cannot route around it.
 *  - Tools read only aggregate services (no per-person rows exist to leak).
 *  - No RLS scope spans the LLM round-trip; each tool scopes its own DB work.
 *
 * Deliberately simpler than the tenant analytics chat: no session persistence or
 * streaming yet (product polish). The safety properties above are the point.
 */
@Injectable()
export class PlatformAnalyticsChatService {
  private readonly logger = new Logger(PlatformAnalyticsChatService.name);

  constructor(
    @Inject(aiConfig.KEY) private readonly config: AiConfig,
    private readonly llmFactory: LlmProviderFactory,
    private readonly tools: PlatformAiToolsService,
  ) {}

  async query(params: PlatformChatParams): Promise<PlatformChatResult> {
    const { provider, model, maxTokens } = this.llmFactory.forFeature('analytics');
    if (!provider.isAvailable) {
      throw new ServiceUnavailableException(
        'Platform AI is not available (disabled or unconfigured).',
      );
    }

    const ctx: PlatformToolContext = {
      userId: params.userId,
      facets: params.facets,
      clearanceLevel: params.clearanceLevel,
    };

    const grantedFacets = [...params.facets]
      .filter((f) => f.startsWith('platform.'))
      .sort();

    const system = [
      {
        text:
          'You are the platform operations assistant for a multi-tenant school ' +
          'management platform. You help a platform operator understand the estate ' +
          'ACROSS all schools (tenants).\n\n' +
          'Hard rules:\n' +
          '- You may only report AGGREGATE information (counts, rates, distributions, ' +
          'risk flags) via the provided tools. You have no access to any individual ' +
          "pupil, parent, or staff record, and must refuse requests for one.\n" +
          '- If a tool reports the caller lacks the required permission, tell the ' +
          'operator that data is outside their access — do not speculate or work around it.\n' +
          `- The operator holds these platform facets: ${
            grantedFacets.join(', ') || '(none)'
          }.\n` +
          '- Be concise and cite the numbers the tools return.',
      },
    ];

    const messages: LlmMessage[] = [
      { role: 'user', content: [{ type: 'text', text: params.question }] },
    ];
    const toolDefinitions = this.tools.list().map((t) => t.definition);
    const traces: PlatformToolTrace[] = [];
    let finalTurn: LlmAssistantTurn | null = null;

    const maxIterations = this.config.AI_TOOL_LOOP_MAX_ITERATIONS;
    for (let i = 0; i <= maxIterations; i++) {
      let turn: LlmAssistantTurn | undefined;
      for await (const event of provider.stream({
        model,
        maxTokens,
        system,
        messages,
        tools: toolDefinitions,
      })) {
        if (event.type === 'turn_complete') turn = event.turn;
      }
      if (!turn) throw new Error('LLM stream ended without a completed turn');

      const toolCalls = turnToolCalls(turn);
      if (turn.stopReason !== 'tool_use' || toolCalls.length === 0) {
        finalTurn = turn;
        break;
      }

      const capReached = i >= maxIterations - 1;
      const results: LlmToolResultPart[] = [];
      for (const call of toolCalls) {
        if (capReached) {
          results.push({
            type: 'tool_result',
            toolCallId: call.id,
            content: 'Step limit reached — answer with the data already gathered.',
            isError: true,
          });
          continue;
        }
        results.push(await this.runTool(ctx, call, traces));
      }

      messages.push({ role: 'assistant', content: turn.content });
      messages.push({ role: 'user', content: results });
    }

    return {
      answer: finalTurn
        ? turnText(finalTurn)
        : 'I could not complete this within the allowed number of steps.',
      toolCalls: traces,
    };
  }

  /** Execute one tool call, enforcing the facet at execution time. */
  private async runTool(
    ctx: PlatformToolContext,
    call: { id: string; name: string; input: Record<string, unknown> },
    traces: PlatformToolTrace[],
  ): Promise<LlmToolResultPart> {
    const tool = this.tools.get(call.name);
    if (!tool) {
      traces.push({ tool: call.name, allowed: false, error: 'unknown_tool' });
      return {
        type: 'tool_result',
        toolCallId: call.id,
        content: `Unknown tool: ${call.name}.`,
        isError: true,
      };
    }

    // THE FACET GATE — checked per call, against the caller's own facets.
    if (!ctx.facets.has(tool.requiredFacet)) {
      traces.push({ tool: call.name, allowed: false, error: 'missing_facet' });
      return {
        type: 'tool_result',
        toolCallId: call.id,
        content: `You do not hold the '${tool.requiredFacet}' permission; this data is not available to you.`,
        isError: true,
      };
    }

    try {
      const data = await tool.execute(ctx, call.input ?? {});
      traces.push({ tool: call.name, allowed: true });
      return {
        type: 'tool_result',
        toolCallId: call.id,
        content: JSON.stringify(data),
      };
    } catch (error) {
      this.logger.error(`Platform tool ${call.name} failed`, error as Error);
      traces.push({
        tool: call.name,
        allowed: true,
        error: (error as Error).message,
      });
      return {
        type: 'tool_result',
        toolCallId: call.id,
        content: 'The tool failed to run.',
        isError: true,
      };
    }
  }
}
