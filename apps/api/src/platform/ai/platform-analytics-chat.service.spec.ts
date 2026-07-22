/**
 * PlatformAnalyticsChatService — the 0.5.8 / §7.1 hard gate.
 *
 * The safety-critical property: a tool's facet is checked at EXECUTION against
 * the caller's own facets, and a caller lacking the facet is refused WITHOUT the
 * tool ever running. A stubbed LLM drives a single tool call so we can assert
 * exactly that, without a real Anthropic round-trip.
 */
import { PlatformAnalyticsChatService } from './platform-analytics-chat.service';
import type { LlmAssistantTurn } from '../../ai/llm/llm.types';

/** A stub provider that: turn 1 asks for `toolName`, turn 2 answers with text. */
function stubProvider(toolName: string) {
  let call = 0;
  return {
    providerName: 'stub',
    isAvailable: true,
    async *stream() {
      call += 1;
      const turn: LlmAssistantTurn =
        call === 1
          ? {
              provider: 'stub',
              model: 'stub',
              stopReason: 'tool_use',
              usage: {
                inputTokens: 0,
                outputTokens: 0,
                cacheReadInputTokens: 0,
                cacheCreationInputTokens: 0,
              },
              content: [
                { type: 'tool_call', id: 'c1', name: toolName, input: {} },
              ],
            }
          : {
              provider: 'stub',
              model: 'stub',
              stopReason: 'end_turn',
              usage: {
                inputTokens: 0,
                outputTokens: 0,
                cacheReadInputTokens: 0,
                cacheCreationInputTokens: 0,
              },
              content: [{ type: 'text', text: 'Done.' }],
            };
      yield { type: 'turn_complete' as const, turn };
    },
  };
}

function build(toolName: string, executeSpy: jest.Mock) {
  const llmFactory = {
    forFeature: () => ({
      provider: stubProvider(toolName),
      model: 'stub',
      maxTokens: 1000,
    }),
  };
  const tool = {
    requiredFacet: 'platform.metrics',
    definition: { name: 'get_platform_totals', description: '', inputSchema: {} },
    execute: executeSpy,
  };
  const tools = {
    list: () => [tool],
    get: (n: string) => (n === tool.definition.name ? tool : undefined),
  };
  const config = { AI_TOOL_LOOP_MAX_ITERATIONS: 4 };
  return new PlatformAnalyticsChatService(
    config as never,
    llmFactory as never,
    tools as never,
  );
}

describe('PlatformAnalyticsChatService — facet gate at execution', () => {
  it('executes a tool when the caller HOLDS the required facet', async () => {
    const execute = jest.fn().mockResolvedValue({ totals: { tenants: 7 } });
    const svc = build('get_platform_totals', execute);

    const res = await svc.query({
      userId: 'architect',
      facets: new Set(['platform.metrics']),
      clearanceLevel: 10,
      question: 'How many schools?',
    });

    expect(execute).toHaveBeenCalledTimes(1);
    expect(res.toolCalls).toEqual([
      { tool: 'get_platform_totals', allowed: true },
    ]);
  });

  it('REFUSES the tool — without executing it — when the caller lacks the facet', async () => {
    const execute = jest.fn();
    const svc = build('get_platform_totals', execute);

    // A SuperAdmin: clearance 9, holds tenants.read/act but NOT platform.metrics.
    const res = await svc.query({
      userId: 'superadmin',
      facets: new Set(['platform.tenants.read', 'platform.tenants.act']),
      clearanceLevel: 9,
      question: 'Give me cross-tenant metrics.',
    });

    // The tool never ran — the gate is structural, not advisory.
    expect(execute).not.toHaveBeenCalled();
    expect(res.toolCalls).toEqual([
      { tool: 'get_platform_totals', allowed: false, error: 'missing_facet' },
    ]);
  });

  it('is unavailable when the provider is not configured', async () => {
    const llmFactory = {
      forFeature: () => ({
        provider: { providerName: 'x', isAvailable: false, async *stream() {} },
        model: 'x',
        maxTokens: 1,
      }),
    };
    const svc = new PlatformAnalyticsChatService(
      { AI_TOOL_LOOP_MAX_ITERATIONS: 4 } as never,
      llmFactory as never,
      { list: () => [], get: () => undefined } as never,
    );

    await expect(
      svc.query({
        userId: 'u',
        facets: new Set(),
        clearanceLevel: 10,
        question: 'hi',
      }),
    ).rejects.toThrow(/not available/i);
  });
});
