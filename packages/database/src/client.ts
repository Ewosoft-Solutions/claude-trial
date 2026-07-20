import type { PrismaClient } from '@prisma/client';

// Keep the package entry point free of connection side effects. Applications
// commonly import Prisma types and enums from here while managing their own
// client lifecycle; the CLI/seed singleton lives in singleton.ts.
export type PrismaClientType = PrismaClient;

export * from '@prisma/client';
export * from './sensitive-operations.js';
