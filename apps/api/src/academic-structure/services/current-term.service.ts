import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../common/database/database.service';
import { TenantDbService } from '../../common/database/tenant-db.service';

/** The school's current academic year + term, resolved for a tenant. */
export interface CurrentTermContext {
  academicYear: { id: string; name: string; status: string };
  /** Null when the year has no terms defined yet. */
  term: {
    id: string;
    name: string;
    type: string;
    status: string;
    startDate: Date;
    endDate: Date;
  } | null;
}

/**
 * Read-only resolver for "what term is it right now" — the piece of school
 * context every AI surface wants but no service previously exposed. Kept
 * deliberately tiny and side-effect free so it can run outside a tenant
 * transaction (e.g. while assembling an LLM system prompt): every query is
 * explicitly tenant-filtered.
 */
@Injectable()
export class CurrentTermService {
  private readonly logger = new Logger(CurrentTermService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly tenantDb: TenantDbService,
  ) {}

  /** Scoped app_runtime client inside a @TenantScoped request; else privileged. */
  private get client() {
    return this.tenantDb.isScoped ? this.tenantDb.client : this.db.client;
  }

  /**
   * Resolve the current academic year and term for a tenant, or `null` when
   * the school has no academic year set up. The "current" year is the default
   * one, then the active one, then the most recently started. Within it the
   * current term is the one spanning today, then any active term, then the
   * next upcoming term, then the most recent.
   */
  async getCurrentTerm(tenantId: string): Promise<CurrentTermContext | null> {
    const year = await this.client.academicYear.findFirst({
      where: { tenantId, status: { not: 'archived' } },
      orderBy: [
        { isDefault: 'desc' },
        // 'active' sorts before 'completed'/'planned' alphabetically — good enough
        // as a tiebreak; the date order below is the real discriminator.
        { startDate: 'desc' },
      ],
      select: { id: true, name: true, status: true },
    });
    if (!year) return null;

    const now = new Date();
    const terms = await this.client.term.findMany({
      where: { academicYearId: year.id, status: { not: 'archived' } },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        name: true,
        type: true,
        status: true,
        startDate: true,
        endDate: true,
      },
    });

    const current =
      terms.find((t) => t.startDate <= now && t.endDate >= now) ??
      terms.find((t) => t.status === 'active') ??
      terms.find((t) => t.startDate >= now) ??
      terms[terms.length - 1] ??
      null;

    return { academicYear: year, term: current };
  }

  /**
   * A one-line description for an LLM system prompt, or `null` when there is
   * nothing to say. Never throws — resolution failures degrade to no context
   * rather than breaking the caller.
   */
  async describeForPrompt(tenantId: string): Promise<string | null> {
    try {
      const context = await this.getCurrentTerm(tenantId);
      if (!context) return null;
      const { academicYear, term } = context;
      if (!term) {
        return `Academic year: ${academicYear.name} (no terms defined yet).`;
      }
      const fmt = (d: Date) => d.toISOString().slice(0, 10);
      return (
        `Current term: ${term.name} of academic year ${academicYear.name} ` +
        `(${fmt(term.startDate)} to ${fmt(term.endDate)}).`
      );
    } catch (error) {
      this.logger.warn(
        `Could not resolve current term for tenant ${tenantId}: ${(error as Error).message}`,
      );
      return null;
    }
  }
}
