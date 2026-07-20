import { Inject, Injectable, Logger } from '@nestjs/common';
import { aiConfig } from '../config/ai.config';
import type { AiConfig } from '../config/ai.config';
import { AiUnavailableError } from '../services/anthropic.service';
import {
  EmbeddingInputType,
  EmbeddingsProvider,
  EmbeddingsRequestError,
} from './embeddings.types';

const VOYAGE_API_URL = 'https://api.voyageai.com/v1/embeddings';
/** Voyage accepts up to 128 inputs per request. */
const MAX_BATCH_SIZE = 128;

interface VoyageEmbeddingsResponse {
  data: Array<{ index: number; embedding: number[] }>;
  model: string;
  usage?: { total_tokens?: number };
}

/**
 * Voyage AI EmbeddingsProvider — the only file that speaks the Voyage wire
 * format. Plain fetch (no SDK): the API is a single POST endpoint.
 * Model/dimensions come from AI_EMBEDDINGS_MODEL / AI_EMBEDDINGS_DIMENSIONS;
 * the dimension MUST stay in sync with the material_chunks vector column.
 */
@Injectable()
export class VoyageEmbeddingsService implements EmbeddingsProvider {
  private readonly logger = new Logger(VoyageEmbeddingsService.name);

  readonly providerName = 'voyage';

  constructor(@Inject(aiConfig.KEY) private readonly config: AiConfig) {}

  get isAvailable(): boolean {
    return this.config.AI_ENABLED && Boolean(this.config.VOYAGE_API_KEY);
  }

  get dimensions(): number {
    return this.config.AI_EMBEDDINGS_DIMENSIONS;
  }

  async embed(
    texts: string[],
    inputType: EmbeddingInputType,
  ): Promise<number[][]> {
    if (!this.isAvailable) {
      throw new AiUnavailableError(
        'Embeddings are not available (AI disabled or VOYAGE_API_KEY missing)',
      );
    }
    if (texts.length === 0) return [];

    const vectors: number[][] = [];
    for (let start = 0; start < texts.length; start += MAX_BATCH_SIZE) {
      const batch = texts.slice(start, start + MAX_BATCH_SIZE);
      vectors.push(...(await this.embedBatch(batch, inputType)));
    }
    return vectors;
  }

  private async embedBatch(
    batch: string[],
    inputType: EmbeddingInputType,
  ): Promise<number[][]> {
    let response: Response;
    try {
      response = await fetch(VOYAGE_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.VOYAGE_API_KEY}`,
        },
        body: JSON.stringify({
          model: this.config.AI_EMBEDDINGS_MODEL,
          input: batch,
          input_type: inputType,
          output_dimension: this.config.AI_EMBEDDINGS_DIMENSIONS,
        }),
      });
    } catch (error) {
      throw new EmbeddingsRequestError(
        'Embeddings request failed (network error)',
        undefined,
        error,
      );
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      this.logger.warn(
        `Voyage embeddings request failed: ${response.status} ${body.slice(0, 500)}`,
      );
      throw new EmbeddingsRequestError(
        `Embeddings request failed with status ${response.status}`,
        response.status,
      );
    }

    const payload = (await response.json()) as VoyageEmbeddingsResponse;
    if (!Array.isArray(payload.data) || payload.data.length !== batch.length) {
      throw new EmbeddingsRequestError(
        `Embeddings response shape mismatch: expected ${batch.length} vectors, got ${payload.data?.length ?? 0}`,
      );
    }

    // Voyage returns entries with an index — order defensively by it.
    return [...payload.data]
      .sort((a, b) => a.index - b.index)
      .map((entry) => entry.embedding);
  }
}
