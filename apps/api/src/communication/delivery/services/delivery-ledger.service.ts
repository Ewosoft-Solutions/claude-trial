import { Injectable } from '@nestjs/common';
import { Prisma } from '@workspace/database';

import { TenantDbService } from '../../../common/database/tenant-db.service';

export interface LedgerFilter {
  channel?: string;
  status?: string;
  campaignId?: string;
  limit?: number;
  offset?: number;
}

export interface ChannelUsage {
  channel: string;
  sentCount: number;
  costUnits: number;
}

/**
 * Read side of the delivery ledger — the "SMS balance + delivery log" (C105) that
 * reproduces PURELY from DeliveryAttempt rows. `usage()` sums the metered cost of
 * charged sends (status sent|delivered) per channel; `list()` is the delivery log.
 */
@Injectable()
export class DeliveryLedgerService {
  constructor(private readonly tenantDb: TenantDbService) {}

  private get client(): Prisma.TransactionClient {
    return this.tenantDb.client;
  }

  async list(tenantId: string, filter: LedgerFilter) {
    const limit = Math.min(Math.max(filter.limit ?? 50, 1), 200);
    const offset = Math.max(filter.offset ?? 0, 0);
    const where: Prisma.DeliveryAttemptWhereInput = {
      tenantId,
      ...(filter.channel ? { channel: filter.channel } : {}),
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.campaignId ? { campaignId: filter.campaignId } : {}),
    };
    const [rows, total] = await Promise.all([
      this.client.deliveryAttempt.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.client.deliveryAttempt.count({ where }),
    ]);
    return { rows, total, limit, offset };
  }

  /**
   * Per-channel usage: number of charged sends + total metered cost. Only
   * sent/delivered attempts are charged (a suppressed/failed attempt costs 0),
   * so this reconstructs the prepaid balance draw-down from the ledger alone.
   */
  async usage(tenantId: string, channel?: string): Promise<ChannelUsage[]> {
    const grouped = await this.client.deliveryAttempt.groupBy({
      by: ['channel'],
      where: {
        tenantId,
        status: { in: ['sent', 'delivered'] },
        ...(channel ? { channel } : {}),
      },
      _count: { _all: true },
      _sum: { costUnits: true },
    });
    return grouped.map((g) => ({
      channel: g.channel,
      sentCount: g._count._all,
      costUnits: g._sum.costUnits ? Number(g._sum.costUnits) : 0,
    }));
  }
}
