/**
 * Resolves the LlmProvider + model for a feature, per request.
 *
 * Today every feature resolves to the platform-keyed AnthropicService with a
 * per-feature model from env (tier indirection, platform-managed). Resolving
 * through a factory — rather than binding the provider as a key-singleton —
 * keeps the door open for per-tenant BYOK (AiSettings row, Step 6) without
 * touching the tool loop.
 */
import { Inject, Injectable } from '@nestjs/common';
import { aiConfig } from '../config/ai.config';
import type { AiConfig } from '../config/ai.config';
import { AnthropicService } from '../services/anthropic.service';
import type { LlmProvider } from './llm.types';

export type AiFeature = 'analytics' | 'tutor';

export interface ResolvedLlm {
  provider: LlmProvider;
  model: string;
  maxTokens: number;
}

@Injectable()
export class LlmProviderFactory {
  constructor(
    @Inject(aiConfig.KEY) private readonly config: AiConfig,
    private readonly anthropicService: AnthropicService,
  ) {}

  forFeature(feature: AiFeature): ResolvedLlm {
    const model =
      feature === 'analytics'
        ? (this.config.AI_MODEL_ANALYTICS ?? this.config.AI_MODEL)
        : (this.config.AI_MODEL_TUTOR ?? this.config.AI_MODEL);

    return {
      provider: this.anthropicService,
      model,
      maxTokens: this.config.AI_MAX_TOKENS,
    };
  }
}
