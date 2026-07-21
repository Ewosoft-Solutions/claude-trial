// Jest stub for @workspace/database used in unit tests
export class PrismaClient {}

/**
 * Known-request-error stand-in, shaped like the real Prisma class.
 *
 * Services narrow database failures with
 * `error instanceof Prisma.PrismaClientKnownRequestError && error.code === '…'`
 * (see security-policy and sensitive-operation-policy). An empty namespace made
 * that expression THROW under test — `instanceof undefined` is a TypeError — so
 * those branches could not be covered, and a test hitting one saw a confusing
 * TypeError instead of the error the service actually raised.
 */
export class PrismaClientKnownRequestError extends Error {
  code: string;
  clientVersion: string;
  meta?: Record<string, unknown>;

  constructor(
    message: string,
    {
      code,
      clientVersion,
      meta,
    }: { code: string; clientVersion: string; meta?: Record<string, unknown> },
  ) {
    super(message);
    this.name = 'PrismaClientKnownRequestError';
    this.code = code;
    this.clientVersion = clientVersion;
    this.meta = meta;
  }
}

// Prisma namespace stub. Tests must construct errors from THIS class so the
// `instanceof` in the code under test resolves against the same constructor.
export const Prisma = { PrismaClientKnownRequestError };

// Export a singleton instance for convenience where a value is expected
export const prisma = new PrismaClient();

// Runtime-safe catalog exports used by auth policy and step-up unit tests.
// Jest does not transform TypeScript outside this app's root, so consume the
// database package's built CommonJS entry rather than duplicating the catalog.
export {
  SENSITIVE_OPERATION_CATALOG,
  SENSITIVE_OPERATION_NAMES,
  getSensitiveOperationDefinition,
} from '../../../../packages/database/dist/sensitive-operations.cjs';
