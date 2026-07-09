/**
 * EmbeddingsProvider port (docs/ai-integration-plan.md Step 4).
 *
 * Same indirection discipline as the LlmProvider port next door: the
 * chunk/retrieval pipeline codes against this interface and never sees
 * provider wire shapes. VoyageEmbeddingsService is the first
 * implementation; the isolation e2e substitutes a deterministic stub.
 */

/**
 * Retrieval-optimized providers embed corpus text and queries differently;
 * callers must say which side they are embedding.
 */
export type EmbeddingInputType = 'document' | 'query';

export interface EmbeddingsProvider {
  readonly providerName: string;
  /** False when the provider has no key or AI is globally disabled. */
  readonly isAvailable: boolean;
  /** Vector length produced — must match the DB column (vector(1024)). */
  readonly dimensions: number;
  /**
   * Embed `texts` in order; returns one vector per input text.
   * Implementations handle provider batch limits internally.
   */
  embed(texts: string[], inputType: EmbeddingInputType): Promise<number[][]>;
}

/** Nest injection token for the configured EmbeddingsProvider. */
export const EMBEDDINGS_PROVIDER = Symbol('EMBEDDINGS_PROVIDER');

/** Thrown when an embeddings request fails (carries HTTP status if any). */
export class EmbeddingsRequestError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'EmbeddingsRequestError';
  }
}
