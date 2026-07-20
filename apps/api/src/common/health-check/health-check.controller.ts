import {
  Controller,
  Get,
  HttpCode,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { TenantDbService } from '../database/tenant-db.service';

/**
 * Infrastructure health probes for the load balancer / platform (Render).
 *
 * Distinct from `HealthModule` (which is the student *health records* domain) —
 * these are liveness/readiness endpoints:
 *
 *  - `GET /healthz` — liveness: the process is up and the event loop responds.
 *    Cheap, no dependencies. Render's health check points here.
 *  - `GET /readyz`  — readiness: the runtime (`app_runtime`) DB connection is
 *    reachable. Returns 503 until dependencies are ready so a bad boot never
 *    takes traffic. Runs through `TenantDbService` — the same restricted
 *    connection real tenant queries use — so a broken RLS wiring surfaces here.
 *
 * Both are unauthenticated by design (probes carry no credentials) and expose
 * no tenant data.
 */
@ApiTags('health-check')
@Controller()
export class HealthCheckController {
  private readonly logger = new Logger(HealthCheckController.name);

  constructor(private readonly tenantDb: TenantDbService) {}

  @Get('healthz')
  @HttpCode(200)
  @ApiOperation({ summary: 'Liveness probe — process is up' })
  liveness(): { status: 'ok' } {
    return { status: 'ok' };
  }

  /**
   * A zero UUID that matches no tenant. Used only to open an RLS scope for the
   * readiness probe; `SELECT 1` touches no tenant tables, so nothing leaks.
   */
  private static readonly PROBE_TENANT_ID =
    '00000000-0000-0000-0000-000000000000';

  @Get('readyz')
  @ApiOperation({ summary: 'Readiness probe — runtime DB connection reachable' })
  async readiness(): Promise<{ status: 'ready'; checks: { database: 'up' } }> {
    try {
      // Trivial round-trip through the app_runtime connection, inside an RLS
      // scope (the client refuses use outside one). Proves the DB is reachable,
      // the restricted runtime client is wired, AND the tenant-GUC path works —
      // without touching any tenant data.
      await this.tenantDb.runScoped(
        HealthCheckController.PROBE_TENANT_ID,
        undefined,
        () => this.tenantDb.client.$queryRaw`SELECT 1`,
      );
    } catch (error) {
      this.logger.error(
        `Readiness check failed: ${(error as Error).message}`,
      );
      throw new ServiceUnavailableException({
        status: 'not_ready',
        checks: { database: 'down' },
      });
    }
    return { status: 'ready', checks: { database: 'up' } };
  }
}
