/**
 * Boot-time RLS enforcement self-test (ADR-004, option A).
 *
 * Runtime tenant isolation is a must-have: the app should connect tenant-data
 * queries through the restricted `app_runtime` role so Postgres RLS actually
 * bites. This service verifies that at startup and, in enforcing environments,
 * refuses to boot when it can't be guaranteed.
 *
 * Policy:
 *  - Enforcement is ON by default in production (or when DB_RLS_ENFORCED=true),
 *    OFF otherwise. Fail-closed when ON, loud-warn when OFF.
 *  - The dangerous silent failure is a runtime connection that *looks* wired but
 *    bypasses RLS (superuser / BYPASSRLS role, or APP_RUNTIME_DATABASE_URL left
 *    equal to the owner). So we don't just check the var is set — we probe the
 *    live connection's role attributes and confirm the tenant GUC takes effect.
 */
import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvConfig } from '../config/env.config';
import { TenantDbService } from './tenant-db.service';

/** Result of probing the live `app_runtime` connection. */
export interface RlsProbe {
  role: string;
  superuser: boolean;
  bypassRls: boolean;
  /** The tenant GUC set by runScoped took effect on this connection. */
  gucApplied: boolean;
}

export interface RlsEvalInput {
  /** APP_RUNTIME_DATABASE_URL is set AND distinct from the owner DATABASE_URL. */
  configured: boolean;
  /** Fail-closed (throw) vs warn. */
  enforced: boolean;
  /** Probe outcome when configured; `{ error }` when the probe threw. */
  probe?: RlsProbe | { error: string };
}

export type RlsVerdict = { action: 'ok' | 'warn' | 'fail'; message: string };

const SEE = 'See docs/database-setup.md §5 and ADR-004.';

/**
 * Pure decision: given the runtime config + probe, decide whether RLS runtime
 * enforcement is proven (ok), missing-but-tolerated (warn), or must fail-closed.
 */
export function evaluateRlsEnforcement(input: RlsEvalInput): RlsVerdict {
  const gate = (message: string): RlsVerdict => ({
    action: input.enforced ? 'fail' : 'warn',
    message,
  });

  if (!input.configured) {
    return gate(
      `RLS is NOT enforced at runtime — APP_RUNTIME_DATABASE_URL is unset (or equal ` +
        `to DATABASE_URL), so tenant queries run on the owner connection and RLS is ` +
        `bypassed. ${SEE}`,
    );
  }

  const p = input.probe;
  if (!p) {
    return gate(`RLS self-test did not run against the app_runtime connection. ${SEE}`);
  }
  if ('error' in p) {
    return gate(`RLS self-test could not run on the app_runtime connection: ${p.error}. ${SEE}`);
  }
  if (p.superuser || p.bypassRls) {
    return gate(
      `The app_runtime connection role '${p.role}' bypasses RLS ` +
        `(superuser=${p.superuser}, bypassrls=${p.bypassRls}) — tenant isolation is NOT ` +
        `enforced. Point APP_RUNTIME_DATABASE_URL at the restricted, non-BYPASSRLS ` +
        `app_runtime role. ${SEE}`,
    );
  }
  if (!p.gucApplied) {
    return gate(
      `The tenant context GUC (app.current_tenant_id) did not take effect on the ` +
        `app_runtime connection — RLS would deny all tenant reads. ${SEE}`,
    );
  }
  return {
    action: 'ok',
    message: `RLS runtime enforcement active (role '${p.role}', bypassrls=false, GUC applied).`,
  };
}

@Injectable()
export class RlsEnforcementService implements OnApplicationBootstrap {
  private readonly logger = new Logger(RlsEnforcementService.name);
  private readonly env: EnvConfig;

  constructor(
    configService: ConfigService,
    private readonly tenantDb: TenantDbService,
  ) {
    this.env = configService.getOrThrow<EnvConfig>('env', { infer: true });
  }

  async onApplicationBootstrap(): Promise<void> {
    const configured =
      !!this.env.APP_RUNTIME_DATABASE_URL &&
      this.env.APP_RUNTIME_DATABASE_URL !== this.env.DATABASE_URL;
    const enforced =
      this.env.DB_RLS_ENFORCED ?? this.env.NODE_ENV === 'production';

    const probe = configured ? await this.probe() : undefined;
    const verdict = evaluateRlsEnforcement({ configured, enforced, probe });

    if (verdict.action === 'fail') {
      this.logger.error(verdict.message);
      throw new Error(`RLS enforcement check failed: ${verdict.message}`);
    }
    if (verdict.action === 'warn') {
      this.logger.warn(`⚠ ${verdict.message}`);
    } else {
      this.logger.log(`✔ ${verdict.message}`);
    }
  }

  /** Probe the live app_runtime connection: role attributes + GUC effect. */
  private async probe(): Promise<RlsProbe | { error: string }> {
    const BOGUS = '00000000-0000-0000-0000-000000000000';
    try {
      return await this.tenantDb.runScoped(BOGUS, undefined, async () => {
        const rows = await this.tenantDb.client.$queryRaw<
          Array<{
            role: string;
            superuser: boolean;
            bypassrls: boolean;
            guc_applied: boolean;
          }>
        >`
          SELECT current_user::text AS role,
                 (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) AS superuser,
                 (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user) AS bypassrls,
                 (current_setting('app.current_tenant_id', true) = ${BOGUS}) AS guc_applied
        `;
        const r = rows[0];
        return {
          role: r?.role ?? 'unknown',
          superuser: !!r?.superuser,
          bypassRls: !!r?.bypassrls,
          gucApplied: !!r?.guc_applied,
        };
      });
    } catch (e) {
      return { error: (e as Error).message };
    }
  }
}
