import { Injectable } from '@nestjs/common';
import type {
  AdapterSendResult,
  ChannelAdapter,
  OutboundMessage,
} from '../delivery.types';

/**
 * In-app channel: there is no external provider, so a send is immediately
 * `delivered`. The in-app inbox surface (Message/Announcement) is a separate
 * consumer; this adapter exists so the same DeliveryService path + ledger cover
 * in-app notices uniformly (cost 0).
 */
@Injectable()
export class InAppChannelAdapter implements ChannelAdapter {
  readonly channel = 'in_app' as const;
  readonly provider = 'in_app';

  async send(message: OutboundMessage): Promise<AdapterSendResult> {
    return {
      provider: this.provider,
      providerMessageId: `in-app-${message.idempotencyKey}`,
      status: 'delivered',
    };
  }
}
