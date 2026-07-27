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
import {
  PASSWORD_RESET_EMAIL_JOB,
  type PasswordResetEmailPayload,
} from './jobs/password-reset-email.job';
import { buildPasswordResetEmail } from './templates/password-reset-email.template';

/**
 * Registers the email-sending queue handlers on boot, so enqueuing an
 * email jobs actually compose and deliver messages via the configured
 * EmailService. Keeps producers decoupled from composition and transport.
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
    this.queue.registerHandler<PasswordResetEmailPayload>(
      PASSWORD_RESET_EMAIL_JOB,
      (payload) => this.sendPasswordReset(payload),
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

  private async sendPasswordReset(
    payload: PasswordResetEmailPayload,
  ): Promise<void> {
    const resetUrl = `${this.webUrl}/reset-password?token=${encodeURIComponent(payload.resetToken)}`;
    const message = buildPasswordResetEmail({
      to: payload.email,
      recipientName: payload.recipientName,
      resetUrl,
      expiresAt: payload.expiresAt,
    });
    await this.email.send(message);
  }
}
