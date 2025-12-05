// Jest stub for @workspace/database used in unit tests
export class PrismaClient {}

// Provide a no-op Prisma namespace to satisfy potential imports
export const Prisma = {};

// Export a singleton instance for convenience where a value is expected
export const prisma = new PrismaClient();
