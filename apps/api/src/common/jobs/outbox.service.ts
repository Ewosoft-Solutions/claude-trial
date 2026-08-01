import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { TenantDbService } from '../database/tenant-db.service';

export interface EmitOutboxInput {
  /** Aggregate name, e.g. 'Payment', 'ResultPublication'. */
  aggregate: string;
  aggregateId: string;
  /** Event type, e.g. 'payment.recorded'. */
  type: string;
  payload?: unknown;
  /** null = platform/system event. */
  tenantId?: string | null;
}

/**
 * Transactional outbox. `emit` writes a side-effect *intent* in the caller's
 * transaction — atomic with the domain change — so an event is never lost and a
 * rolled-back command leaves no phantom event. A relay (future) publishes
 * unpublished events idempotently on the job worker.
 */
@Injectable()
export class OutboxService {
  constructor(private readonly tenantDb: TenantDbService) {}

  /** Write an outbox event in the caller's RLS-scoped transaction. */
  async emit(input: EmitOutboxInput): Promise<string> {
    const id = randomUUID();
    const payloadJson =
      input.payload == null ? null : JSON.stringify(input.payload);
    await this.tenantDb.client.$executeRaw`
      INSERT INTO "jobs"."outbox_events"
        ("id","tenant_id","aggregate","aggregate_id","type","payload","created_at")
      VALUES
        (${id}, ${input.tenantId ?? null}, ${input.aggregate}, ${input.aggregateId},
         ${input.type}, ${payloadJson}::jsonb, now())
    `;
    return id;
  }
}
