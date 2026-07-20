// Jest stub for @workspace/database used in unit tests
export class PrismaClient {}

// Provide a no-op Prisma namespace to satisfy potential imports
export const Prisma = {};

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
