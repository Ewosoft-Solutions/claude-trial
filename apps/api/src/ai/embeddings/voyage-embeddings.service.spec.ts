/**
 * VoyageEmbeddingsService unit tests — availability gate, batching,
 * index-ordered responses, error mapping. fetch is mocked; no network.
 */
import { VoyageEmbeddingsService } from './voyage-embeddings.service';
import { EmbeddingsRequestError } from './embeddings.types';
import { AiUnavailableError } from '../services/anthropic.service';
import type { AiConfig } from '../config/ai.config';

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
  VOYAGE_API_KEY: 'voyage-test-key',
  AI_EMBEDDINGS_MODEL: 'voyage-3.5-lite',
  AI_EMBEDDINGS_DIMENSIONS: 4,
};

function okResponse(count: number, offset = 0) {
  return {
    ok: true,
    json: async () => ({
      // Reversed order to prove we re-sort by index.
      data: Array.from({ length: count }, (_, i) => ({
        index: count - 1 - i,
        embedding: [count - 1 - i + offset, 0, 0, 0],
      })),
      model: 'voyage-3.5-lite',
    }),
  } as Response;
}

describe('VoyageEmbeddingsService', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('is unavailable without a key or with AI disabled', async () => {
    const noKey = new VoyageEmbeddingsService({
      ...baseConfig,
      VOYAGE_API_KEY: undefined,
    });
    expect(noKey.isAvailable).toBe(false);
    await expect(noKey.embed(['x'], 'query')).rejects.toBeInstanceOf(
      AiUnavailableError,
    );

    const disabled = new VoyageEmbeddingsService({
      ...baseConfig,
      AI_ENABLED: false,
    });
    expect(disabled.isAvailable).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('embeds texts and returns vectors in input order', async () => {
    fetchMock.mockResolvedValueOnce(okResponse(2));
    const service = new VoyageEmbeddingsService(baseConfig);

    const vectors = await service.embed(['a', 'b'], 'document');
    expect(vectors).toEqual([
      [0, 0, 0, 0],
      [1, 0, 0, 0],
    ]);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      model: 'voyage-3.5-lite',
      input: ['a', 'b'],
      input_type: 'document',
      output_dimension: 4,
    });
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer voyage-test-key',
    );
  });

  it('splits inputs beyond the batch limit across requests', async () => {
    fetchMock
      .mockResolvedValueOnce(okResponse(128))
      .mockResolvedValueOnce(okResponse(2, 1000));
    const service = new VoyageEmbeddingsService(baseConfig);

    const texts = Array.from({ length: 130 }, (_, i) => `t${i}`);
    const vectors = await service.embed(texts, 'document');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(vectors).toHaveLength(130);
    expect(vectors[128][0]).toBe(1000); // first vector of the second batch
  });

  it('returns an empty result without calling the API', async () => {
    const service = new VoyageEmbeddingsService(baseConfig);
    await expect(service.embed([], 'query')).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps HTTP failures to EmbeddingsRequestError with status', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 429,
      text: async () => 'rate limited',
    } as Response);
    const service = new VoyageEmbeddingsService(baseConfig);

    await expect(service.embed(['x'], 'query')).rejects.toMatchObject({
      name: 'EmbeddingsRequestError',
      status: 429,
    });
  });

  it('rejects response shape mismatches', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [] }),
    } as Response);
    const service = new VoyageEmbeddingsService(baseConfig);

    await expect(service.embed(['x'], 'query')).rejects.toBeInstanceOf(
      EmbeddingsRequestError,
    );
  });
});
