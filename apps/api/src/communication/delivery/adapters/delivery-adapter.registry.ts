import { Injectable, Logger } from '@nestjs/common';
import type { ChannelAdapter, DeliveryChannel } from '../delivery.types';
import { LogSmsAdapter } from './log-sms.adapter';
import { LogPushAdapter } from './log-push.adapter';
import { InAppChannelAdapter } from './in-app-channel.adapter';
import { EmailChannelAdapter } from './email-channel.adapter';

/**
 * Resolves a channel to its adapter. Producers depend only on DeliveryService;
 * the job handler asks this registry which transport to use. `set()` lets a test
 * (or a future runtime-config layer) swap an adapter for a channel — the same
 * pattern the JobHandlerRegistry uses for handlers.
 */
@Injectable()
export class DeliveryAdapterRegistry {
  private readonly logger = new Logger(DeliveryAdapterRegistry.name);
  private readonly adapters = new Map<DeliveryChannel, ChannelAdapter>();

  constructor(
    email: EmailChannelAdapter,
    sms: LogSmsAdapter,
    push: LogPushAdapter,
    inApp: InAppChannelAdapter,
  ) {
    this.set(email);
    this.set(sms);
    this.set(push);
    this.set(inApp);
  }

  /** Register/override the adapter for a channel. */
  set(adapter: ChannelAdapter): void {
    this.adapters.set(adapter.channel, adapter);
  }

  get(channel: DeliveryChannel): ChannelAdapter {
    const adapter = this.adapters.get(channel);
    if (!adapter) {
      throw new Error(`No delivery adapter registered for channel=${channel}`);
    }
    return adapter;
  }

  has(channel: DeliveryChannel): boolean {
    return this.adapters.has(channel);
  }
}
