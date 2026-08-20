import { Injectable } from '@nestjs/common';
import { TenantDbService } from '../../common/database/tenant-db.service';

/** The actionable figures the sidebar rolls up into its badges. */
export interface NavCounts {
  /** Admission applications awaiting a decision. */
  admissionsPending: number;
  /** Fee invoices still owing (issued / partial / overdue). */
  outstandingInvoices: number;
  /** User invitations sent but not yet accepted. */
  pendingInvitations: number;
  /** Discretionary discounts waiting on a second authority. */
  pendingAdjustments: number;
}

/**
 * Nav Counts Service
 *
 * A lean, purpose-built source for the sidebar's rolled-up badge counts —
 * just the few actionable figures the nav renders, as cheap tenant-scoped
 * COUNTs. Deliberately NOT the dashboard aggregate (`/overview/stats`): that
 * runs ~14 figures the nav ignores, and the sidebar loads on EVERY page, so a
 * badge should not cost a full dashboard roll-up.
 *
 * These figures mirror the equivalents in OverviewService, so the numbers
 * stay identical to what the sidebar showed before. Display-gating (which
 * badge a given viewer actually sees) stays in the web `resolveNavigation`,
 * the single source of truth for nav visibility — so this endpoint is not
 * permission-scoped and simply returns the tenant's counts.
 */
@Injectable()
export class NavCountsService {
  constructor(private readonly tenantDb: TenantDbService) {}

  /** Scoped app_runtime client — the endpoint is always `@TenantScoped`. */
  private get client() {
    return this.tenantDb.client;
  }

  async getCounts(tenantId: string): Promise<NavCounts> {
    const [
      admissionsPending,
      outstandingInvoices,
      pendingInvitations,
      pendingAdjustments,
    ] = await Promise.all([
        this.client.admissionApplication.count({
          where: { tenantId, decision: 'pending' },
        }),
        this.client.feeInvoice.count({
          where: { tenantId, status: { in: ['issued', 'partial', 'overdue'] } },
        }),
        this.client.userTenant.count({
          where: {
            tenantId,
            invitationToken: { not: null },
            status: 'pending',
          },
        }),
        // Policy adjustments are pre-approved and post themselves, so only
        // discretionary ones are waiting on a person.
        this.client.feeAdjustment.count({
          where: { tenantId, status: 'pending', source: 'discretionary' },
        }),
      ]);

    return {
      admissionsPending,
      outstandingInvoices,
      pendingInvitations,
      pendingAdjustments,
    };
  }
}
