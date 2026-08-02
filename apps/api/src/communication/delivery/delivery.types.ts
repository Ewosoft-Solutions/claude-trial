/**
 * Communication delivery — port + shared types (F5 / ADR-07).
 *
 * A domain never calls a provider SDK directly. It publishes a *message intent*
 * to DeliveryService, which resolves audience → preference/consent → channel →
 * provider, records a DeliveryAttempt (the evidence ledger), and sends
 * idempotently on the F3 job substrate. `ChannelAdapter` is the seam every
 * concrete transport (SMS provider, email, push) implements — mirroring the
 * EmailProvider / StorageProvider port pattern already used in the codebase.
 */

export type DeliveryChannel = 'sms' | 'email' | 'push' | 'in_app';

/**
 * Lawful-basis / consent class of a message:
 * - `critical`     — lawful/contractual notice; overrides a non-consent opt-out.
 * - `transactional`— account/operational; sent to opted-in recipients.
 * - `marketing`    — non-essential; requires opt-in, suppressed otherwise.
 */
export type DeliveryCategory = 'transactional' | 'critical' | 'marketing';

export type DeliveryStatus =
  | 'queued'
  | 'sent'
  | 'delivered'
  | 'failed'
  | 'dnd_blocked'
  | 'suppressed';

export type DeliveryFailureClass =
  | 'provider_error'
  | 'invalid_destination'
  | 'no_contact'
  | 'dnd'
  | 'no_consent'
  | 'quiet_hours'
  | 'rate_limited';

/** A single provider-bound message the adapter must transmit. */
export interface OutboundMessage {
  channel: DeliveryChannel;
  /** Real destination (email address / E.164 phone / device token). Never logged raw. */
  destination: string;
  subject?: string;
  body: string;
  /**
   * Provider-side idempotency key (the DeliveryAttempt id). An adapter that
   * supports it MUST not re-transmit a message it already accepted for this key,
   * so a job retry after an ack timeout does not double-send.
   */
  idempotencyKey: string;
  from?: string;
}

export interface AdapterSendResult {
  /** Provider identifier that handled the send (e.g. 'log', 'smtp', 'sendgrid'). */
  provider: string;
  /** Provider's message id / receipt. */
  providerMessageId: string;
  /** Sync adapters may report `delivered`; async ones report `sent`. */
  status: 'sent' | 'delivered';
}

/** The transport seam. One adapter per channel (a provider hides behind it). */
export interface ChannelAdapter {
  readonly channel: DeliveryChannel;
  readonly provider: string;
  send(message: OutboundMessage): Promise<AdapterSendResult>;
}

/** A domain's request to reach a recipient — the input to DeliveryService.send. */
export interface SendIntent {
  tenantId: string;
  channel: DeliveryChannel;
  category?: DeliveryCategory;

  /** Recipient by Person (contact + consent resolved from the person) … */
  personId?: string;
  /** … and/or the profile (UserTenant) the send is attributed to. */
  profileId?: string;
  /** Explicit destination — overrides the person's primary contact point. */
  destination?: string;

  /** Rendered content, or a template to render. */
  subject?: string;
  body?: string;
  templateKey?: string;
  locale?: string;
  variables?: Record<string, unknown>;

  /** Idempotency: two sends with the same (tenant, dedupeKey) collapse to one attempt. */
  dedupeKey?: string;
  campaignId?: string;
  secureLinkId?: string;
  actorId?: string;
  metadata?: Record<string, unknown>;
  /** Sender label passed to the adapter (email from / sms sender id). */
  from?: string;
}

export interface SendResult {
  attemptId: string;
  status: DeliveryStatus;
  /** true when an existing attempt for the same (tenant, dedupeKey) was returned. */
  deduped: boolean;
  costUnits: number;
  suppressed: boolean;
  failureClass?: DeliveryFailureClass;
}
