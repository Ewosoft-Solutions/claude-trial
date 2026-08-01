import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { writeAuditLog, type AuditLogInput } from './audit-writer';

/**
 * Injectable audit writer for tenant-scoped domain services.
 *
 * Lives in `common/` — the sanctioned home for audit writes (`check:privileged-db`
 * allowlists this layer) — so domain services never inject the privileged
 * `DatabaseService` themselves just to record an action. `writeAuditLog` runs on
 * its OWN transaction on the owner connection: an audit failure is logged and
 * swallowed (auditing must never take down the request it records), and a caller
 * whose own transaction later rolls back still leaves the audit trail intact.
 */
@Injectable()
export class AuditService {
  constructor(private readonly db: DatabaseService) {}

  /** Best-effort audit write; resolves to whether the row landed. */
  write(input: AuditLogInput): Promise<boolean> {
    return writeAuditLog(this.db.client, input);
  }
}
