import { Module } from '@nestjs/common';
import { CommonModule } from '../common';
import { AuthModule } from '../auth/auth.module';
import { JobsModule } from '../common/jobs/jobs.module';
import { CommunicationService } from './services/communication.service';
import { AnnouncementController } from './controllers/announcement.controller';
import { MessageController } from './controllers/message.controller';

// F5 · delivery abstraction (ADR-07)
import { DeliveryService } from './delivery/services/delivery.service';
import { DeliveryLedgerService } from './delivery/services/delivery-ledger.service';
import { ContactPreferenceService } from './delivery/services/contact-preference.service';
import { SecureLinkService } from './delivery/services/secure-link.service';
import { TemplateService } from './delivery/services/template.service';
import { CampaignService } from './delivery/services/campaign.service';
import { DeliveryAdapterRegistry } from './delivery/adapters/delivery-adapter.registry';
import { EmailChannelAdapter } from './delivery/adapters/email-channel.adapter';
import { LogSmsAdapter } from './delivery/adapters/log-sms.adapter';
import { LogPushAdapter } from './delivery/adapters/log-push.adapter';
import { InAppChannelAdapter } from './delivery/adapters/in-app-channel.adapter';
import { DeliveryJobRegistrar } from './delivery/jobs/delivery-job.registrar';
import { DeliveryController } from './delivery/controllers/delivery.controller';
import { ContactPreferencesController } from './delivery/controllers/contact-preferences.controller';
import { SecureLinksController } from './delivery/controllers/secure-links.controller';
import { CampaignsController } from './delivery/controllers/campaigns.controller';
import { TemplatesController } from './delivery/controllers/templates.controller';

/**
 * Communication: the existing Announcement/Message surfaces plus the F5 delivery
 * abstraction (ADR-07) — a provider-agnostic DeliveryService + channel adapters,
 * the DeliveryAttempt ledger (cost/DND/consent evidence), ContactPreference,
 * MessageTemplate/Campaign, and SecureLink. Sends run on the F3 job substrate.
 */
@Module({
  imports: [CommonModule, AuthModule, JobsModule],
  controllers: [
    AnnouncementController,
    MessageController,
    DeliveryController,
    ContactPreferencesController,
    SecureLinksController,
    CampaignsController,
    TemplatesController,
  ],
  providers: [
    CommunicationService,
    // delivery services
    DeliveryService,
    DeliveryLedgerService,
    ContactPreferenceService,
    SecureLinkService,
    TemplateService,
    CampaignService,
    // channel adapters + registry
    DeliveryAdapterRegistry,
    EmailChannelAdapter,
    LogSmsAdapter,
    LogPushAdapter,
    InAppChannelAdapter,
    // durable send handler
    DeliveryJobRegistrar,
  ],
  exports: [
    CommunicationService,
    DeliveryService,
    SecureLinkService,
    ContactPreferenceService,
    TemplateService,
    CampaignService,
  ],
})
export class CommunicationModule {}
