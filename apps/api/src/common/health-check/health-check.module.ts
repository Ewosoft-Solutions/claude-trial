import { Module } from '@nestjs/common';

import { HealthCheckController } from './health-check.controller';

/**
 * Infrastructure liveness/readiness probes (`/healthz`, `/readyz`).
 * `TenantDbService` is provided by the global `DatabaseModule`, so no imports
 * are needed here.
 */
@Module({
  controllers: [HealthCheckController],
})
export class HealthCheckModule {}
