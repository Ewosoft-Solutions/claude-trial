import {
  EmailQueueRegistrar,
  INVITATION_EMAIL_JOB,
  PASSWORD_RESET_EMAIL_JOB,
  type PasswordResetEmailPayload,
} from '.';
import type { QueueHandler } from '../queue/queue.service';

describe('EmailQueueRegistrar', () => {
  it('registers password-reset delivery and builds the public reset link', async () => {
    const handlers = new Map<string, QueueHandler>();
    const queue = {
      registerHandler: jest.fn((type: string, handler: QueueHandler) => {
        handlers.set(type, handler);
      }),
    };
    const email = { send: jest.fn().mockResolvedValue(undefined) };
    const config = {
      getOrThrow: jest.fn().mockReturnValue({
        APP_WEB_URL: 'https://app.schoolwithease.test',
      }),
    };
    const registrar = new EmailQueueRegistrar(
      queue as never,
      email as never,
      config as never,
    );

    registrar.onModuleInit();

    expect(handlers.has(INVITATION_EMAIL_JOB)).toBe(true);
    const handler = handlers.get(PASSWORD_RESET_EMAIL_JOB);
    expect(handler).toBeDefined();

    await handler!(
      {
        email: 'teacher@example.com',
        resetToken: 'token with reserved?characters',
        recipientName: 'Ada',
        expiresAt: new Date('2026-07-27T15:00:00.000Z'),
      } satisfies PasswordResetEmailPayload,
      {} as never,
    );

    expect(email.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'teacher@example.com',
        subject: 'Reset your SchoolWithEase password',
        html: expect.stringContaining(
          'https://app.schoolwithease.test/reset-password?token=token%20with%20reserved%3Fcharacters',
        ),
        text: expect.stringContaining('Hi Ada,'),
      }),
    );
  });
});
