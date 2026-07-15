/**
 * Environment Configuration
 *
 * Centralized environment variable configuration with validation.
 * Uses Joi to enforce shape/defaults and exposes both a Nest ConfigModule
 * loader and a plain helper for non-Nest contexts.
 */
import 'dotenv/config';
import { ConfigType, registerAs } from '@nestjs/config';
import Joi from 'joi';

export interface EnvironmentConfig {
  DATABASE_URL: string;
  /**
   * Optional runtime connection as the restricted, non-BYPASSRLS `app_runtime`
   * role. When set, tenant-data services use it so Postgres RLS enforces tenant
   * isolation at runtime. Falls back to DATABASE_URL (owner) when unset — RLS is
   * then bypassed (pre-cutover behaviour, no regression). See ADR-004.
   */
  APP_RUNTIME_DATABASE_URL?: string;
  /**
   * Force the boot-time RLS enforcement self-test to fail-closed (throw) instead
   * of warn. When unset it defaults to ON in production and OFF elsewhere, so
   * prod cannot silently boot without runtime tenant isolation. Set explicitly
   * to override (e.g. `true` to enforce in staging, `false` to opt a prod-like
   * box out deliberately). See RlsEnforcementService + ADR-004.
   */
  DB_RLS_ENFORCED?: boolean;
  NODE_ENV: 'development' | 'test' | 'production' | string;
  PORT: number;
  /**
   * Opt-in debug error payloads (details/stack/internal messages) on HTTP
   * error responses. Unset principle: defaults to false and must be set to
   * `true` explicitly — NODE_ENV=development alone never exposes internals.
   * Read raw off process.env by HttpExceptionFilter.
   */
  API_DEBUG_ERRORS: boolean;
  /**
   * Root directory for the local-disk StorageProvider (lesson material
   * binaries). Relative paths resolve against the API process cwd.
   */
  STORAGE_LOCAL_ROOT: string;
  JWT_SECRET?: string;
  ENCRYPTION_KEY?: string;
  WEBAUTHN_RP_NAME: string;
  WEBAUTHN_RP_ID: string;
  WEBAUTHN_ORIGIN: string;
  /**
   * Comma-separated allow-list of origins a passkey assertion may come from
   * (e.g. tenant subdomains). Optional — falls back to `[WEBAUTHN_ORIGIN]`.
   */
  WEBAUTHN_ALLOWED_ORIGINS?: string;
  /**
   * Public origin of the web app, used to build user-facing links in outbound
   * email (e.g. the invitation accept link `${APP_WEB_URL}/accept-invite?...`).
   * No trailing slash.
   */
  APP_WEB_URL: string;
  DB_POOL_MIN: number;
  DB_POOL_MAX: number;
  DB_CONNECTION_TIMEOUT: number;
  DB_QUERY_TIMEOUT: number;
  DB_LOG_QUERIES: boolean;
  DB_LOG_ERRORS: boolean;
  DB_LOG_WARNINGS: boolean;
  SMS_PROVIDER?: string;
  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
  TWILIO_PHONE_NUMBER?: string;
  AWS_SNS_REGION?: string;
  AWS_ACCESS_KEY_ID?: string;
  AWS_SECRET_ACCESS_KEY?: string;
  EMAIL_PROVIDER?: string;
  SMTP_HOST?: string;
  SMTP_PORT?: number;
  SMTP_USER?: string;
  SMTP_PASSWORD?: string;
  SMTP_SECURE: boolean;
  SMTP_FROM_EMAIL?: string;
  SMTP_FROM_NAME?: string;
  SENDGRID_API_KEY?: string;
  AWS_SES_REGION?: string;
  AUDIT_LOG_DESTINATION?: string;
  AUDIT_LOG_FILE_PATH?: string;
  AUDIT_LOG_EXTERNAL_URL?: string;
  AUDIT_LOG_EXTERNAL_API_KEY?: string;
  AUDIT_LOG_ENABLED: boolean;
  MONITORING_PROVIDER?: string;
  DATADOG_API_KEY?: string;
  DATADOG_APP_KEY?: string;
  NEW_RELIC_LICENSE_KEY?: string;
  SENTRY_DSN?: string;
  SENTRY_ENVIRONMENT?: string;
  ALERT_EMAIL?: string;
  ALERT_WEBHOOK_URL?: string;
  MONITORING_ENABLED: boolean;
}

/**
 * Joi validation schema for environment variables.
 * Converts types (number/boolean) and applies sensible defaults.
 */
export const envValidationSchema = Joi.object({
  DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgres', 'postgresql'] })
    .required(),
  APP_RUNTIME_DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgres', 'postgresql'] })
    .optional(),
  DB_RLS_ENFORCED: Joi.boolean().truthy('true').falsy('false').optional(),
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  PORT: Joi.number().integer().min(1).max(65535).default(3000),
  API_DEBUG_ERRORS: Joi.boolean()
    .truthy('true')
    .falsy('false')
    .default(false),
  STORAGE_LOCAL_ROOT: Joi.string().default('./storage'),
  JWT_SECRET: Joi.string().optional(),
  ENCRYPTION_KEY: Joi.string().optional(),
  WEBAUTHN_RP_NAME: Joi.string().default('School With Ease'),
  WEBAUTHN_RP_ID: Joi.string().default('localhost'),
  WEBAUTHN_ORIGIN: Joi.string().default('http://localhost:3001'),
  WEBAUTHN_ALLOWED_ORIGINS: Joi.string().optional(),
  APP_WEB_URL: Joi.string()
    .uri()
    .default('http://localhost:3001')
    .custom((value: string) => value.replace(/\/+$/, '')),
  DB_POOL_MIN: Joi.number().integer().min(1).max(100).default(2),
  DB_POOL_MAX: Joi.number().integer().min(1).max(100).default(10),
  DB_CONNECTION_TIMEOUT: Joi.number().integer().min(1000).default(5000),
  DB_QUERY_TIMEOUT: Joi.number().integer().min(1000).default(30000),
  DB_LOG_QUERIES: Joi.boolean().truthy('true').falsy('false').default(false),
  DB_LOG_ERRORS: Joi.boolean().truthy('true').falsy('false').default(true),
  DB_LOG_WARNINGS: Joi.boolean().truthy('true').falsy('false').default(true),
  SMS_PROVIDER: Joi.string().optional(),
  TWILIO_ACCOUNT_SID: Joi.string().optional(),
  TWILIO_AUTH_TOKEN: Joi.string().optional(),
  TWILIO_PHONE_NUMBER: Joi.string().optional(),
  AWS_SNS_REGION: Joi.string().optional(),
  AWS_ACCESS_KEY_ID: Joi.string().optional(),
  AWS_SECRET_ACCESS_KEY: Joi.string().optional(),
  EMAIL_PROVIDER: Joi.string().optional(),
  SMTP_HOST: Joi.string().optional(),
  SMTP_PORT: Joi.number().integer().optional(),
  SMTP_USER: Joi.string().optional(),
  SMTP_PASSWORD: Joi.string().optional(),
  SMTP_SECURE: Joi.boolean().truthy('true').falsy('false').default(false),
  SMTP_FROM_EMAIL: Joi.string().optional(),
  SMTP_FROM_NAME: Joi.string().optional(),
  SENDGRID_API_KEY: Joi.string().optional(),
  AWS_SES_REGION: Joi.string().optional(),
  AUDIT_LOG_DESTINATION: Joi.string().optional(),
  AUDIT_LOG_FILE_PATH: Joi.string().optional(),
  AUDIT_LOG_EXTERNAL_URL: Joi.string().optional(),
  AUDIT_LOG_EXTERNAL_API_KEY: Joi.string().optional(),
  AUDIT_LOG_ENABLED: Joi.boolean().truthy('true').falsy('false').default(true),
  MONITORING_PROVIDER: Joi.string().optional(),
  DATADOG_API_KEY: Joi.string().optional(),
  DATADOG_APP_KEY: Joi.string().optional(),
  NEW_RELIC_LICENSE_KEY: Joi.string().optional(),
  SENTRY_DSN: Joi.string().optional(),
  SENTRY_ENVIRONMENT: Joi.string().optional(),
  ALERT_EMAIL: Joi.string().optional(),
  ALERT_WEBHOOK_URL: Joi.string().optional(),
  MONITORING_ENABLED: Joi.boolean().truthy('true').falsy('false').default(true),
});

const validationOptions = {
  abortEarly: false,
  allowUnknown: true,
  stripUnknown: true,
  convert: true,
};

let validatedConfig: EnvironmentConfig | null = null;

export function validateEnv(
  source: NodeJS.ProcessEnv = process.env,
): EnvironmentConfig {
  const { value, error } = envValidationSchema.validate(
    source,
    validationOptions,
  );

  if (error) {
    const message = error.details.map((detail) => detail.message).join('\n');
    throw new Error(`Environment configuration validation failed:\n${message}`);
  }

  return value as EnvironmentConfig;
}

/**
 * Load and cache environment configuration for both Nest and non-Nest consumers.
 */
export function loadEnvConfig(
  source: NodeJS.ProcessEnv = process.env,
): EnvironmentConfig {
  if (!validatedConfig || source !== process.env) {
    validatedConfig = validateEnv(source);
  }
  return validatedConfig;
}

/**
 * Nest ConfigModule loader for the validated environment configuration.
 */
export const envConfig = registerAs(
  'env',
  (): EnvironmentConfig => loadEnvConfig(),
);

/**
 * Strongly typed view of the env config as exposed by ConfigService.
 */
export type EnvConfig = ConfigType<typeof envConfig>;
