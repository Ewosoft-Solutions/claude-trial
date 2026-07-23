/**
 * Test Utilities
 *
 * Shared utilities for testing including Prisma mocks and test helpers.
 * Uses jest-mock-extended for proper type-safe mocking of Prisma Client.
 *
 * Based on Prisma's official testing documentation:
 * https://www.prisma.io/docs/orm/prisma-client/testing/unit-testing
 */

import { PrismaClient } from '@workspace/database';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { Provider } from '@nestjs/common';
import { PRISMA_CLIENT_TOKEN } from '../database/database.service';

/**
 * Context type for dependency injection pattern
 * This allows passing Prisma Client to functions that need it
 */
export type Context = {
  prisma: PrismaClient;
};

/**
 * Mock context type for testing
 * Provides type-safe access to all Prisma Client methods
 */
export type MockContext = {
  prisma: DeepMockProxy<PrismaClient>;
};

/**
 * Create a mock Prisma client context for testing
 *
 * Uses jest-mock-extended's mockDeep to create a fully typed mock
 * that maintains type safety while allowing method mocking.
 *
 * @returns Mock context with properly typed Prisma Client mock
 *
 * @example
 * ```ts
 * let mockCtx: MockContext;
 * let ctx: Context;
 *
 * beforeEach(() => {
 *   mockCtx = createMockContext();
 *   ctx = mockCtx as unknown as Context;
 * });
 *
 * test('should create user', async () => {
 *   const user = { id: 1, email: 'test@example.com' };
 *   mockCtx.prisma.user.create.mockResolvedValue(user);
 *   await createUser(user, ctx);
 * });
 * ```
 */
export function createMockContext(): MockContext {
  const prisma = mockDeep<PrismaClient>();

  // Services scope their reads with `withTenantScope` / `withUserScope`, which
  // open a transaction to hold the RLS GUC. mockDeep stubs `$transaction` to
  // return undefined, so without this the callback never runs and every scoped
  // read resolves to undefined — a failure mode that looks like a broken query
  // rather than a missing mock. Run the callback against the same mock: these
  // are unit tests of service logic, not of isolation.
  // Typed loosely on purpose: threading the deep mock through a
  // `PrismaClient`-typed callback makes tsc expand Prisma's recursive filter
  // types and fail with TS2615 across every model.
  const transaction = prisma.$transaction as unknown as {
    mockImplementation: (fn: (arg: unknown) => unknown) => void;
  };
  transaction.mockImplementation((arg: unknown) =>
    typeof arg === 'function'
      ? (arg as (tx: unknown) => unknown)(prisma)
      : // Array form: `$transaction([p1, p2])` resolves the promises as-is.
        Promise.all(arg as Promise<unknown>[]),
  );

  return { prisma };
}

/**
 * Create a NestJS provider for PrismaClient mock
 *
 * This helper makes it easy to provide a mocked PrismaClient
 * in NestJS testing modules.
 *
 * @param mockPrisma - Optional mock Prisma client. If not provided, a new one will be created.
 * @returns NestJS provider configuration for PrismaClient
 *
 * @example
 * ```ts
 * const mockCtx = createMockContext();
 * const module: TestingModule = await Test.createTestingModule({
 *   providers: [
 *     MyService,
 *     createPrismaClientProvider(mockCtx.prisma),
 *   ],
 * }).compile();
 * ```
 */
export function createPrismaClientProvider(
  mockPrisma?: DeepMockProxy<PrismaClient>,
): Provider {
  const prisma = mockPrisma || mockDeep<PrismaClient>();
  return {
    provide: PRISMA_CLIENT_TOKEN,
    useValue: prisma,
  };
}
