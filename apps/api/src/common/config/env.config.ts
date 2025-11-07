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
  ValidateIf,
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
