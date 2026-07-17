import path from 'node:path';
import { config as loadEnv } from 'dotenv';

// Load the API's real local test/development connections before applying
// fallbacks. dotenv preserves values supplied explicitly by CI.
loadEnv({ path: path.resolve(__dirname, '../.env'), quiet: true });

// Minimal defaults for e2e tests that do not require a database connection.
process.env.DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5432/testdb';
process.env.WEBAUTHN_ORIGIN =
  process.env.WEBAUTHN_ORIGIN || 'https://example.com';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
process.env.ENCRYPTION_KEY =
  process.env.ENCRYPTION_KEY || 'test-encryption-key';
