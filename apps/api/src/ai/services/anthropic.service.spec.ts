/**
 * AnthropicService unit tests
 *
 * The SDK is mocked — these prove the wrapper's wiring (config defaults,
 * availability gating, error mapping, ping round-trip shape). The live
 * round-trip is exercised by GET /ai/health once ANTHROPIC_API_KEY is set.
 */
import {
  AnthropicService,
  AiUnavailableError,
  AnthropicRequestError,
} from './anthropic.service';
import type { AiConfig } from '../config/ai.config';

const mockCreate = jest.fn();
const mockStream = jest.fn();

jest.mock('@anthropic-ai/sdk', () => {
  class MockAPIError extends Error {
    status?: number;
  }
  class MockAnthropic {
    static APIError = MockAPIError;
    messages = { create: mockCreate, stream: mockStream };
    constructor(readonly opts: unknown) {}
  }
  return { __esModule: true, default: MockAnthropic };
});

const baseConfig: AiConfig = {
  ANTHROPIC_API_KEY: 'test-key',
  AI_MODEL: 'claude-opus-4-8',
  AI_MAX_TOKENS: 4096,
  AI_ENABLED: true,
  AI_TOOL_LOOP_MAX_ITERATIONS: 5,
  AI_HISTORY_MAX_MESSAGES: 20,
  AI_RATE_LIMIT_PER_MINUTE: 10,
  AI_DAILY_MESSAGE_CAP: 200,
  AI_MONTHLY_TOKEN_BUDGET: 1_000_000,
  AI_TENANT_CONCURRENCY_LIMIT: 3,
  AI_SPEND_ALERT_THRESHOLD_PERCENT: 80,
  AI_EMBEDDINGS_MODEL: 'voyage-3.5-lite',
  AI_EMBEDDINGS_DIMENSIONS: 1024,
};

describe('AnthropicService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('availability', () => {
    it('is available with a key and AI_ENABLED', () => {
      expect(new AnthropicService(baseConfig).isAvailable).toBe(true);
    });

    it('is unavailable without a key', () => {
      const service = new AnthropicService({
        ...baseConfig,
        ANTHROPIC_API_KEY: undefined,
      });
      expect(service.isAvailable).toBe(false);
    });

    it('is unavailable when the kill switch is off, even with a key', () => {
      const service = new AnthropicService({
        ...baseConfig,
        AI_ENABLED: false,
      });
      expect(service.isAvailable).toBe(false);
    });

    it('rejects calls with AiUnavailableError when unavailable', async () => {
      const service = new AnthropicService({
        ...baseConfig,
        AI_ENABLED: false,
      });
      await expect(
        service.createMessage({
          messages: [{ role: 'user', content: 'ping' }],
        }),
      ).rejects.toBeInstanceOf(AiUnavailableError);
      expect(mockCreate).not.toHaveBeenCalled();
    });
  });

  describe('createMessage', () => {
    it('applies model and max_tokens from config', async () => {
      mockCreate.mockResolvedValue({ id: 'msg_1' });
      const service = new AnthropicService(baseConfig);

      await service.createMessage({
        messages: [{ role: 'user', content: 'ping' }],
      });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'claude-opus-4-8',
          max_tokens: 4096,
        }),
      );
    });

    it('allows per-call model/max_tokens overrides', async () => {
      mockCreate.mockResolvedValue({ id: 'msg_1' });
      const service = new AnthropicService(baseConfig);

      await service.createMessage({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        messages: [{ role: 'user', content: 'ping' }],
      });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 512,
        }),
      );
    });

    it('maps SDK failures to AnthropicRequestError', async () => {
      mockCreate.mockRejectedValue(new Error('boom'));
      const service = new AnthropicService(baseConfig);

      await expect(
        service.createMessage({
          messages: [{ role: 'user', content: 'ping' }],
        }),
      ).rejects.toBeInstanceOf(AnthropicRequestError);
    });
  });

  describe('ping', () => {
    it('returns ok with model and latency on a successful round-trip', async () => {
      mockCreate.mockResolvedValue({ id: 'msg_1' });
      const service = new AnthropicService(baseConfig);

      const result = await service.ping();

      expect(result.ok).toBe(true);
      expect(result.model).toBe('claude-opus-4-8');
      expect(typeof result.latencyMs).toBe('number');
    });
  });

  describe('toTypedError', () => {
    it('passes AiUnavailableError through unchanged', () => {
      const service = new AnthropicService(baseConfig);
      const original = new AiUnavailableError();
      expect(service.toTypedError(original)).toBe(original);
    });

    it('wraps unknown errors in AnthropicRequestError', () => {
      const service = new AnthropicService(baseConfig);
      const mapped = service.toTypedError(new Error('network down'));
      expect(mapped).toBeInstanceOf(AnthropicRequestError);
      expect(mapped.message).toContain('network down');
    });
  });
});
