/**
 * Environment Configuration
 *
 * Centralized environment variable configuration with validation.
 * Ensures all required environment variables are present and valid.
 */

import { plainToInstance } from 'class-transformer';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsUrl,
  validateSync,
  Min,
  Max,
} from 'class-validator';

/**
 * Environment Configuration Schema
 *
 * Defines all environment variables with validation rules.
 */
class EnvironmentConfig {
  // Database Configuration
  @IsString()
  @IsUrl({ require_tld: false })
  DATABASE_URL!: string;

  // Application Configuration
  @IsString()
  @IsOptional()
  NODE_ENV: string = 'development';

  @IsNumber()
  @Min(1)
  @Max(65535)
  @IsOptional()
  PORT: number = 3000;

  // JWT Configuration
  @IsString()
  @IsOptional()
  JWT_SECRET?: string; // Fallback secret (not used for school-specific secrets)

  // Encryption Configuration
  @IsString()
  @IsOptional()
  ENCRYPTION_KEY?: string; // Master encryption key for sensitive data

  // WebAuthn Configuration
  @IsString()
  @IsOptional()
  WEBAUTHN_RP_NAME: string = 'School Management System';

  @IsString()
  @IsOptional()
  WEBAUTHN_RP_ID: string = 'localhost';

  @IsString()
  @IsUrl()
  @IsOptional()
  WEBAUTHN_ORIGIN: string = 'http://localhost:3000';

  // Database Connection Pool Configuration
  @IsNumber()
  @Min(1)
  @Max(100)
  @IsOptional()
  DB_POOL_MIN: number = 2;

  @IsNumber()
  @Min(1)
  @Max(100)
  @IsOptional()
  DB_POOL_MAX: number = 10;

  @IsNumber()
  @Min(1000)
  @IsOptional()
  DB_CONNECTION_TIMEOUT: number = 5000; // milliseconds

  @IsNumber()
  @Min(1000)
  @IsOptional()
  DB_QUERY_TIMEOUT: number = 30000; // milliseconds

  // Logging Configuration
  @IsBoolean()
  @IsOptional()
  DB_LOG_QUERIES: boolean = false;

  @IsBoolean()
  @IsOptional()
  DB_LOG_ERRORS: boolean = true;

  @IsBoolean()
  @IsOptional()
  DB_LOG_WARNINGS: boolean = true;

  // MFA SMS Configuration (Twilio, AWS SNS, etc.)
  @IsString()
  @IsOptional()
  SMS_PROVIDER?: string; // 'twilio' | 'aws-sns' | 'console' (for development)

  @IsString()
  @IsOptional()
  TWILIO_ACCOUNT_SID?: string;

  @IsString()
  @IsOptional()
  TWILIO_AUTH_TOKEN?: string;

  @IsString()
  @IsOptional()
  TWILIO_PHONE_NUMBER?: string;

  @IsString()
  @IsOptional()
  AWS_SNS_REGION?: string;

  @IsString()
  @IsOptional()
  AWS_ACCESS_KEY_ID?: string;

  @IsString()
  @IsOptional()
  AWS_SECRET_ACCESS_KEY?: string;

  // MFA Email Configuration
  @IsString()
  @IsOptional()
  EMAIL_PROVIDER?: string; // 'smtp' | 'sendgrid' | 'ses' | 'console' (for development)

  @IsString()
  @IsOptional()
  SMTP_HOST?: string;

  @IsNumber()
  @IsOptional()
  SMTP_PORT?: number;

  @IsString()
  @IsOptional()
  SMTP_USER?: string;

  @IsString()
  @IsOptional()
  SMTP_PASSWORD?: string;

  @IsBoolean()
  @IsOptional()
  SMTP_SECURE: boolean = false; // TLS/SSL

  @IsString()
  @IsOptional()
  SMTP_FROM_EMAIL?: string;

  @IsString()
  @IsOptional()
  SMTP_FROM_NAME?: string;

  @IsString()
  @IsOptional()
  SENDGRID_API_KEY?: string;

  @IsString()
  @IsOptional()
  AWS_SES_REGION?: string;

  // Audit Logging Configuration
  @IsString()
  @IsOptional()
  AUDIT_LOG_DESTINATION?: string; // 'database' | 'file' | 'external' | 'all'

  @IsString()
  @IsOptional()
  AUDIT_LOG_FILE_PATH?: string; // Path for file-based audit logs

  @IsString()
  @IsOptional()
  AUDIT_LOG_EXTERNAL_URL?: string; // External audit log service URL

  @IsString()
  @IsOptional()
  AUDIT_LOG_EXTERNAL_API_KEY?: string; // API key for external audit service

  @IsBoolean()
  @IsOptional()
  AUDIT_LOG_ENABLED: boolean = true;

  // Monitoring & Alerting Configuration
  @IsString()
  @IsOptional()
  MONITORING_PROVIDER?: string; // 'datadog' | 'newrelic' | 'sentry' | 'none'

  @IsString()
  @IsOptional()
  DATADOG_API_KEY?: string;

  @IsString()
  @IsOptional()
  DATADOG_APP_KEY?: string;

  @IsString()
  @IsOptional()
  NEW_RELIC_LICENSE_KEY?: string;

  @IsString()
  @IsOptional()
  SENTRY_DSN?: string;

  @IsString()
  @IsOptional()
  SENTRY_ENVIRONMENT?: string;

  @IsString()
  @IsOptional()
  ALERT_EMAIL?: string; // Email for critical alerts

  @IsString()
  @IsOptional()
  ALERT_WEBHOOK_URL?: string; // Webhook URL for alerts (Slack, PagerDuty, etc.)

  @IsBoolean()
  @IsOptional()
  MONITORING_ENABLED: boolean = true;
}

/**
 * Validated environment configuration
 */
let validatedConfig: EnvironmentConfig;

/**
 * Get environment configuration
 *
 * Validates and returns environment configuration.
 * Throws error if required variables are missing or invalid.
 *
 * @returns Validated environment configuration
 */
export function getEnvConfig(): EnvironmentConfig {
  if (validatedConfig) {
    return validatedConfig;
  }

  // Create instance from environment variables
  const config = plainToInstance(EnvironmentConfig, {
    DATABASE_URL: process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 3000,
    JWT_SECRET: process.env.JWT_SECRET,
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
    WEBAUTHN_RP_NAME:
      process.env.WEBAUTHN_RP_NAME || 'School Management System',
    WEBAUTHN_RP_ID: process.env.WEBAUTHN_RP_ID || 'localhost',
    WEBAUTHN_ORIGIN: process.env.WEBAUTHN_ORIGIN || 'http://localhost:3000',
    DB_POOL_MIN: process.env.DB_POOL_MIN
      ? parseInt(process.env.DB_POOL_MIN, 10)
      : 2,
    DB_POOL_MAX: process.env.DB_POOL_MAX
      ? parseInt(process.env.DB_POOL_MAX, 10)
      : 10,
    DB_CONNECTION_TIMEOUT: process.env.DB_CONNECTION_TIMEOUT
      ? parseInt(process.env.DB_CONNECTION_TIMEOUT, 10)
      : 5000,
    DB_QUERY_TIMEOUT: process.env.DB_QUERY_TIMEOUT
      ? parseInt(process.env.DB_QUERY_TIMEOUT, 10)
      : 30000,
    DB_LOG_QUERIES: process.env.DB_LOG_QUERIES === 'true',
    DB_LOG_ERRORS: process.env.DB_LOG_ERRORS !== 'false',
    DB_LOG_WARNINGS: process.env.DB_LOG_WARNINGS !== 'false',
    // MFA SMS Configuration
    SMS_PROVIDER: process.env.SMS_PROVIDER,
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
    TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER,
    AWS_SNS_REGION: process.env.AWS_SNS_REGION,
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
    // MFA Email Configuration
    EMAIL_PROVIDER: process.env.EMAIL_PROVIDER,
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT
      ? parseInt(process.env.SMTP_PORT, 10)
      : undefined,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASSWORD: process.env.SMTP_PASSWORD,
    SMTP_SECURE: process.env.SMTP_SECURE === 'true',
    SMTP_FROM_EMAIL: process.env.SMTP_FROM_EMAIL,
    SMTP_FROM_NAME: process.env.SMTP_FROM_NAME,
    SENDGRID_API_KEY: process.env.SENDGRID_API_KEY,
    AWS_SES_REGION: process.env.AWS_SES_REGION,
    // Audit Logging Configuration
    AUDIT_LOG_DESTINATION: process.env.AUDIT_LOG_DESTINATION,
    AUDIT_LOG_FILE_PATH: process.env.AUDIT_LOG_FILE_PATH,
    AUDIT_LOG_EXTERNAL_URL: process.env.AUDIT_LOG_EXTERNAL_URL,
    AUDIT_LOG_EXTERNAL_API_KEY: process.env.AUDIT_LOG_EXTERNAL_API_KEY,
    AUDIT_LOG_ENABLED: process.env.AUDIT_LOG_ENABLED !== 'false',
    // Monitoring & Alerting Configuration
    MONITORING_PROVIDER: process.env.MONITORING_PROVIDER,
    DATADOG_API_KEY: process.env.DATADOG_API_KEY,
    DATADOG_APP_KEY: process.env.DATADOG_APP_KEY,
    NEW_RELIC_LICENSE_KEY: process.env.NEW_RELIC_LICENSE_KEY,
    SENTRY_DSN: process.env.SENTRY_DSN,
    SENTRY_ENVIRONMENT: process.env.SENTRY_ENVIRONMENT,
    ALERT_EMAIL: process.env.ALERT_EMAIL,
    ALERT_WEBHOOK_URL: process.env.ALERT_WEBHOOK_URL,
    MONITORING_ENABLED: process.env.MONITORING_ENABLED !== 'false',
  });

  // Validate configuration
  const errors = validateSync(config, {
    skipMissingProperties: false,
    whitelist: true,
    forbidNonWhitelisted: true,
  });

  if (errors.length > 0) {
    const errorMessages = errors
      .map((error) => {
        const constraints = Object.values(error.constraints || {});
        return `${error.property}: ${constraints.join(', ')}`;
      })
      .join('\n');

    throw new Error(
      `Environment configuration validation failed:\n${errorMessages}`,
    );
  }

  validatedConfig = config;
  return validatedConfig;
}

/**
 * Environment variable helper functions
 */
export const env = {
  /**
   * Get environment variable or throw error if missing
   */
  required(key: string): string {
    const value = process.env[key];
    if (!value) {
      throw new Error(`Required environment variable ${key} is missing`);
    }
    return value;
  },

  /**
   * Get environment variable with default value
   */
  optional(key: string, defaultValue: string): string {
    return process.env[key] || defaultValue;
  },

  /**
   * Get boolean environment variable
   */
  boolean(key: string, defaultValue: boolean = false): boolean {
    const value = process.env[key];
    if (!value) {
      return defaultValue;
    }
    return value.toLowerCase() === 'true';
  },

  /**
   * Get number environment variable
   */
  number(key: string, defaultValue: number): number {
    const value = process.env[key];
    if (!value) {
      return defaultValue;
    }
    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) {
      return defaultValue;
    }
    return parsed;
  },
};
