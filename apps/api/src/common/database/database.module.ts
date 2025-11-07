import { Global, Module } from '@nestjs/common';
import { PrismaClient } from '@workspace/database';
import { DatabaseService } from './database.service';

/**
 * Database Module
 *
 * Provides Prisma client instance and database-related services.
 * This module is global to make database services available throughout the app.
 */
@Global()
@Module({
  providers: [
    {
      provide: PrismaClient,
      useFactory: () => {
        return new PrismaClient({
          log:
            process.env.NODE_ENV === 'development'
              ? ['query', 'error', 'warn']
              : ['error'],
        });
      },
    },
    DatabaseService,
  ],
  exports: [PrismaClient, DatabaseService],
})
export class DatabaseModule {}
