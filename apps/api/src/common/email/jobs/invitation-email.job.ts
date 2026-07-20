/** Queue job type + payload for sending an invitation email. */
export const INVITATION_EMAIL_JOB = 'invitation-email';

export interface InvitationEmailPayload {
  email: string;
  invitationToken: string;
  tenantName: string;
  roleName?: string | null;
  recipientName?: string | null;
  expiresAt?: string | Date | null;
}
