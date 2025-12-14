// Minimal defaults for e2e tests
process.env.DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://localhost:5432/testdb';
process.env.WEBAUTHN_ORIGIN =
  process.env.WEBAUTHN_ORIGIN || 'https://example.com';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
process.env.ENCRYPTION_KEY =
  process.env.ENCRYPTION_KEY || 'test-encryption-key';
