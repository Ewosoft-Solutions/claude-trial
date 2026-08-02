/** Durable job type + payload for performing a delivery send (F5 on F3). */
export const DELIVERY_SEND_JOB = 'delivery.send';

/**
 * The job carries the *transient* send material (real destination + rendered
 * body) so the long-lived DeliveryAttempt ledger keeps only a redacted
 * destination. The job row is tenant-scoped (RLS) and short-lived.
 */
export interface DeliverySendPayload {
  attemptId: string;
  destination: string;
  subject?: string;
  body: string;
  from?: string;
}
