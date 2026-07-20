/**
 * AI Configuration
 *
 * Environment configuration for the AI module (Anthropic), validated with Joi
 * and exposed through Nest ConfigModule under the 'ai' namespace.
 *
 * AI_ENABLED is a tenant-independent kill switch: even with a valid key, ops
 * can turn all AI features off. A missing ANTHROPIC_API_KEY never blocks boot;
 * it just leaves the AI features unavailable (AnthropicService.isAvailable).
 */
import { ConfigType, registerAs } from '@nestjs/config';
import Joi from 'joi';

export interface AiEnvironmentConfig {
  ANTHROPIC_API_KEY?: string;
  AI_MODEL: string;
  /** Per-feature model override (tier indirection); falls back to AI_MODEL. */
  AI_MODEL_ANALYTICS?: string;
  /**
   * Tutor model (tier indirection). Defaults to claude-haiku-4-5: the
   * academic tutor is student-scale volume and its answers are grounded in
   * retrieved lesson chunks, so the cheapest/fastest tier is the right
   * default. Institutions can tier up (e.g. claude-opus-4-8) via env without
   * a code change. Falls back to AI_MODEL when unset.
   */
  AI_MODEL_TUTOR?: string;
  AI_MAX_TOKENS: number;
  AI_ENABLED: boolean;
  /** Tool-loop iteration cap per chat request (cost/runaway guard). */
  AI_TOOL_LOOP_MAX_ITERATIONS: number;
  /** How many prior messages to replay into the prompt (bounded history). */
  AI_HISTORY_MAX_MESSAGES: number;
  /** Per-user requests per minute for AI chat endpoints. */
  AI_RATE_LIMIT_PER_MINUTE: number;
  /** Per-user daily message cap for AI chat endpoints. */
  AI_DAILY_MESSAGE_CAP: number;
  /** Platform default monthly tenant token budget until a tenant row overrides it. */
  AI_MONTHLY_TOKEN_BUDGET: number;
  /** Platform default concurrent AI requests per tenant. */
  AI_TENANT_CONCURRENCY_LIMIT: number;
  /** Alert threshold as percent of monthly token budget. */
  AI_SPEND_ALERT_THRESHOLD_PERCENT: number;
  /** Voyage AI key for the embeddings provider (Step 4 lesson substrate). */
  VOYAGE_API_KEY?: string;
  /** Voyage embedding model for lesson-material chunks. */
  AI_EMBEDDINGS_MODEL: string;
  /**
   * Embedding vector length. MUST match the material_chunks embedding
   * column (vector(1024) in the learning_domain migration) — changing one
   * without the other breaks chunk inserts.
   */
  AI_EMBEDDINGS_DIMENSIONS: number;
}

export const aiValidationSchema = Joi.object({
  ANTHROPIC_API_KEY: Joi.string().optional(),
  AI_MODEL: Joi.string().default('claude-opus-4-8'),
  AI_MODEL_ANALYTICS: Joi.string().optional(),
  AI_MODEL_TUTOR: Joi.string().default('claude-haiku-4-5'),
  AI_MAX_TOKENS: Joi.number().integer().min(256).max(64000).default(4096),
  AI_ENABLED: Joi.boolean().truthy('true').falsy('false').default(true),
  AI_TOOL_LOOP_MAX_ITERATIONS: Joi.number().integer().min(1).max(20).default(5),
  AI_HISTORY_MAX_MESSAGES: Joi.number().integer().min(2).max(100).default(20),
  AI_RATE_LIMIT_PER_MINUTE: Joi.number().integer().min(1).max(120).default(10),
  AI_DAILY_MESSAGE_CAP: Joi.number().integer().min(1).max(10000).default(200),
  AI_MONTHLY_TOKEN_BUDGET: Joi.number()
    .integer()
    .min(1000)
    .max(2_000_000_000)
    .default(1_000_000),
  AI_TENANT_CONCURRENCY_LIMIT: Joi.number().integer().min(1).max(100).default(3),
  AI_SPEND_ALERT_THRESHOLD_PERCENT: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .default(80),
  // allow('') so the placeholder `VOYAGE_API_KEY=` line in .env (waiting
  // for a pasted key) doesn't fail validation — empty means unavailable.
  VOYAGE_API_KEY: Joi.string().allow('').optional(),
  AI_EMBEDDINGS_MODEL: Joi.string().default('voyage-3.5-lite'),
  AI_EMBEDDINGS_DIMENSIONS: Joi.number()
    .integer()
    .min(64)
    .max(4096)
    .default(1024),
});

const validationOptions = {
  abortEarly: false,
  allowUnknown: true,
  stripUnknown: true,
  convert: true,
};

export function validateAiEnv(
  source: NodeJS.ProcessEnv = process.env,
): AiEnvironmentConfig {
  const { value, error } = aiValidationSchema.validate(
    source,
    validationOptions,
  );

  if (error) {
    const message = error.details.map((detail) => detail.message).join('\n');
    throw new Error(`AI configuration validation failed:\n${message}`);
  }

  return value as AiEnvironmentConfig;
}

/**
 * Nest ConfigModule loader for the validated AI configuration.
 */
export const aiConfig = registerAs(
  'ai',
  (): AiEnvironmentConfig => validateAiEnv(),
);

/**
 * Strongly typed view of the AI config as exposed by ConfigService.
 */
export type AiConfig = ConfigType<typeof aiConfig>;
