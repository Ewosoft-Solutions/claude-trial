import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvConfig } from '../config/env.config';
import { QueueService } from '../queue/queue.service';
import { EmailService } from './email.service';
import { buildInvitationEmail } from './templates/invitation-email.template';
import {
  INVITATION_EMAIL_JOB,
  type InvitationEmailPayload,
} from './jobs/invitation-email.job';

/**
 * Registers the email-sending queue handlers on boot, so enqueuing an
 * `invitation-email` job actually composes and delivers the message via the
 * configured EmailService. Keeps the producers (e.g. UserInvitationService)
 * decoupled from email composition/transport.
 */
@Injectable()
export class EmailQueueRegistrar implements OnModuleInit {
  private readonly logger = new Logger(EmailQueueRegistrar.name);
  private readonly webUrl: string;

  constructor(
    private readonly queue: QueueService,
    private readonly email: EmailService,
    configService: ConfigService,
  ) {
    const config = configService.getOrThrow<EnvConfig>('env', { infer: true });
    this.webUrl = config.APP_WEB_URL;
  }

  onModuleInit(): void {
    this.queue.registerHandler<InvitationEmailPayload>(
      INVITATION_EMAIL_JOB,
      (payload) => this.sendInvitation(payload),
    );
  }

  private async sendInvitation(payload: InvitationEmailPayload): Promise<void> {
    const acceptUrl = `${this.webUrl}/accept-invite?token=${encodeURIComponent(payload.invitationToken)}`;
    const message = buildInvitationEmail({
      to: payload.email,
      recipientName: payload.recipientName,
      tenantName: payload.tenantName,
      roleName: payload.roleName,
      acceptUrl,
      expiresAt: payload.expiresAt,
    });
    await this.email.send(message);
  }
}
