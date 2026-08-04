import { AccountProvisioningService } from './account-provisioning.service';

function makeService() {
  const personFindFirst = jest.fn();
  const personUpdate = jest.fn();
  const userTenantUpdate = jest.fn();
  const sessionUpdateMany = jest.fn();
  const write = jest.fn();
  const client = {
    person: { findFirst: personFindFirst, update: personUpdate },
    userTenant: { update: userTenantUpdate },
    session: { updateMany: sessionUpdateMany },
  };
  const secureCreate = jest
    .fn()
    .mockResolvedValue({ id: 'sl1', token: 'x', expiresAt: new Date() });
  const send = jest.fn().mockResolvedValue({
    attemptId: 'a1',
    status: 'queued',
    deduped: false,
    costUnits: 0,
    suppressed: false,
  });
  const createInvitation = jest.fn();
  const issueAdminPasswordReset = jest.fn();
  const service = new AccountProvisioningService(
    { client } as never,
    { write } as never,
    { create: secureCreate } as never,
    { send } as never,
    { createInvitation, issueAdminPasswordReset } as never,
    { getOrThrow: () => ({ APP_WEB_URL: 'https://app.test' }) } as never,
  );
  return {
    service,
    personFindFirst,
    personUpdate,
    userTenantUpdate,
    sessionUpdateMany,
    write,
    secureCreate,
    send,
    createInvitation,
    issueAdminPasswordReset,
  };
}

function personRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'per1',
    status: 'active',
    firstName: 'Ada',
    lastName: 'Okafor',
    preferredName: null,
    userTenantId: null,
    contactPoints: [{ value: 'ada@example.test' }],
    account: null,
    ...overrides,
  };
}

function accountRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ut1',
    userId: 'u1',
    status: 'active',
    suspended: false,
    suspendedAt: null,
    suspensionReason: null,
    invitationAcceptedAt: new Date('2026-02-01'),
    invitationExpiresAt: null,
    addedAt: new Date('2026-01-01'),
    user: {
      email: 'ada@example.test',
      firstName: 'Ada',
      lastName: 'Okafor',
      lastLoginAt: null,
    },
    userTenantRole: { role: { name: 'Teacher' } },
    ...overrides,
  };
}

describe('AccountProvisioningService', () => {
  describe('invite', () => {
    it('creates a pending account, mints a SecureLink, and delivers WITHOUT a plaintext password', async () => {
      const t = makeService();
      t.personFindFirst.mockResolvedValue(personRow());
      t.createInvitation.mockResolvedValue({
        id: 'ut1',
        userId: 'u1',
        invitationToken: 'TOK',
        invitationExpiresAt: new Date(Date.now() + 3600_000),
        email: 'ada@example.test',
        roleName: 'Teacher',
        tenantName: 'Sunrise',
        recipientName: 'Ada Okafor',
      });

      await t.service.invite('t1', 'actor', 'per1', { roleId: 'role1' });

      // Delegated user/account creation, no legacy email, shares the token.
      const [, , , options] = t.createInvitation.mock.calls[0];
      expect(options.skipLegacyEmail).toBe(true);
      expect(typeof options.invitationToken).toBe('string');
      const sharedToken = options.invitationToken;

      // The account is linked to the person.
      expect(t.personUpdate).toHaveBeenCalledWith({
        where: { id: 'per1' },
        data: { userTenantId: 'ut1' },
      });

      // The SecureLink governs the SAME token as an invitation link.
      const linkInput = t.secureCreate.mock.calls[0][2];
      expect(linkInput).toMatchObject({
        purpose: 'invitation',
        targetType: 'user_tenant',
        targetId: 'ut1',
        token: sharedToken,
        maxUses: 1,
      });

      // Delivery is account-critical and points at the accept page — never a password.
      const intent = t.send.mock.calls[0][0];
      expect(intent.channel).toBe('email');
      expect(intent.category).toBe('critical');
      expect(intent.body).toContain('/accept-invite?token=');
      expect(intent).not.toHaveProperty('password');
      // No provisioning arg carries a password / hash anywhere.
      const createData = t.createInvitation.mock.calls[0][0];
      expect(JSON.stringify(createData).toLowerCase()).not.toContain(
        'passwordhash',
      );
      expect(intent.body).not.toMatch(/password:\s*\S/i);
    });

    it('refuses to invite a person who already has an account', async () => {
      const t = makeService();
      t.personFindFirst.mockResolvedValue(
        personRow({ userTenantId: 'ut1', account: accountRow() }),
      );
      await expect(
        t.service.invite('t1', 'actor', 'per1', { roleId: 'r' }),
      ).rejects.toThrow(/already has an account/i);
    });
  });

  describe('suspend', () => {
    it('sets the profile suspended, revokes sessions, and audits', async () => {
      const t = makeService();
      t.personFindFirst.mockResolvedValue(personRow({ account: accountRow() }));
      await t.service.suspend('t1', 'actor', 'per1', { reason: 'left' });

      const data = t.userTenantUpdate.mock.calls[0][0].data;
      expect(data.status).toBe('suspended');
      expect(data.suspended).toBe(true);
      expect(data.suspensionReason).toBe('left');
      expect(t.sessionUpdateMany).toHaveBeenCalled();
      expect(t.write.mock.calls[0][0].action).toBe(
        'provisioning.account.suspend',
      );
    });

    it('refuses when already suspended', async () => {
      const t = makeService();
      t.personFindFirst.mockResolvedValue(
        personRow({ account: accountRow({ suspended: true }) }),
      );
      await expect(
        t.service.suspend('t1', 'actor', 'per1', {}),
      ).rejects.toThrow(/already suspended/i);
    });
  });

  describe('reactivate', () => {
    it('restores an accepted account to active', async () => {
      const t = makeService();
      t.personFindFirst.mockResolvedValue(
        personRow({ account: accountRow({ suspended: true }) }),
      );
      await t.service.reactivate('t1', 'actor', 'per1');
      const data = t.userTenantUpdate.mock.calls[0][0].data;
      expect(data.status).toBe('active');
      expect(data.suspended).toBe(false);
    });
  });

  describe('sendPasswordReset', () => {
    it('issues a reset token, governs it as a SecureLink, and delivers a reset link (no password)', async () => {
      const t = makeService();
      t.personFindFirst.mockResolvedValue(personRow({ account: accountRow() }));
      t.issueAdminPasswordReset.mockResolvedValue({
        token: 'RTOK',
        expiresAt: new Date(Date.now() + 3600_000),
      });

      await t.service.sendPasswordReset('t1', 'actor', 'per1');

      expect(t.issueAdminPasswordReset).toHaveBeenCalledWith(
        't1',
        'u1',
        'actor',
      );
      const linkInput = t.secureCreate.mock.calls[0][2];
      expect(linkInput).toMatchObject({
        purpose: 'password_reset',
        targetType: 'user',
        token: 'RTOK',
      });
      const intent = t.send.mock.calls[0][0];
      expect(intent.category).toBe('critical');
      expect(intent.body).toContain('/reset-password?token=RTOK');
      expect(intent.body).not.toMatch(/password:\s*\S/i);
    });

    it('refuses to reset a not-yet-activated account', async () => {
      const t = makeService();
      t.personFindFirst.mockResolvedValue(
        personRow({
          account: accountRow({ invitationAcceptedAt: null }),
        }),
      );
      await expect(
        t.service.sendPasswordReset('t1', 'actor', 'per1'),
      ).rejects.toThrow(/not been activated/i);
    });
  });
});
