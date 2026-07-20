/**
 * AiSettingsService unit tests — the maker-checker mutation flow. The DB,
 * maker-checker, encryption, and permission services are stubbed; these prove
 * plaintext keys never reach the request row, dual control on approval, and
 * that approval patches the settings row.
 */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AiSettingsService } from './ai-settings.service';

function build(options: {
  pendingRequest?: {
    id: string;
    makerId: string;
    requestData: unknown;
    status?: string;
  } | null;
  approveResult?: { approved: boolean; error?: string };
} = {}) {
  const aiSettings = {
    findUnique: jest.fn().mockResolvedValue(null),
    create: jest.fn(async ({ data }: any) => data),
    upsert: jest.fn(async ({ update }: any) => ({ tenantId: 't1', ...update })),
  };
  const makerCheckerRequest = {
    findMany: jest.fn().mockResolvedValue([]),
    findFirst: jest.fn().mockResolvedValue(options.pendingRequest ?? null),
  };
  const client = { aiSettings, makerCheckerRequest };
  const tenantDb = {
    client,
    runScoped: jest.fn((_t: string, _u: string | undefined, fn: () => unknown) =>
      fn(),
    ),
  };
  const makerChecker = {
    createApprovalRequest: jest.fn().mockResolvedValue('req-1'),
    approveRequest: jest
      .fn()
      .mockResolvedValue(options.approveResult ?? { approved: true }),
    rejectRequest: jest.fn().mockResolvedValue({ rejected: true }),
  };
  const encryption = {
    // Model real ciphertext: the plaintext must not appear in the output.
    encryptForStorage: jest.fn(
      (s: string) => `cipher:${Buffer.from(s).toString('base64')}`,
    ),
  };
  const permissionService = {
    getUserPermissionContext: jest.fn().mockResolvedValue({ clearanceLevel: 7 }),
  };
  const db = { client: {} };

  const service = new AiSettingsService(
    db as never,
    tenantDb as never,
    encryption as never,
    permissionService as never,
    makerChecker as never,
  );
  return { service, aiSettings, makerCheckerRequest, makerChecker, encryption };
}

const actor = { tenantId: 't1', userId: 'maker-1', profileId: 'p1' };

describe('AiSettingsService', () => {
  it('records a pending request and never stores the plaintext BYOK key', async () => {
    const { service, makerChecker } = build();
    const res = await service.createChangeRequest({
      ...actor,
      dto: {
        monthlyTokenBudget: 500,
        byokProvider: 'anthropic',
        byokApiKey: 'sk-ant-secret1234',
      },
    });

    expect(res).toEqual({ requestId: 'req-1', status: 'pending' });
    const [, operation, makerId, clearance, requestData] =
      makerChecker.createApprovalRequest.mock.calls[0];
    expect(operation).toBe('ai.settings.update');
    expect(makerId).toBe('maker-1');
    expect(clearance).toBe(7);
    const patch = (requestData as { patch: Record<string, unknown> }).patch;
    expect(patch.monthlyTokenBudget).toBe(500);
    expect(patch.encryptedApiKey).toBe(
      `cipher:${Buffer.from('sk-ant-secret1234').toString('base64')}`,
    );
    expect(patch.keyLast4).toBe('1234');
    expect(JSON.stringify(requestData)).not.toContain('sk-ant-secret1234');
  });

  it('rejects an empty change set', async () => {
    const { service, makerChecker } = build();
    await expect(
      service.createChangeRequest({ ...actor, dto: {} }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(makerChecker.createApprovalRequest).not.toHaveBeenCalled();
  });

  it('requires a key when a BYOK provider is set', async () => {
    const { service } = build();
    await expect(
      service.createChangeRequest({
        ...actor,
        dto: { byokProvider: 'anthropic' },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('clears BYOK when the provider is null', async () => {
    const { service, makerChecker } = build();
    await service.createChangeRequest({
      ...actor,
      dto: { byokProvider: null },
    });
    const patch = (
      makerChecker.createApprovalRequest.mock.calls[0][4] as {
        patch: Record<string, unknown>;
      }
    ).patch;
    expect(patch).toMatchObject({
      byokProvider: null,
      encryptedApiKey: null,
      keyLast4: null,
    });
  });

  it('enforces dual control — the maker cannot approve their own request', async () => {
    const { service, aiSettings, makerChecker } = build({
      pendingRequest: {
        id: 'req-1',
        makerId: 'maker-1',
        requestData: { patch: { monthlyTokenBudget: 10 } },
      },
    });
    await expect(
      service.approveChange({ ...actor, requestId: 'req-1' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(makerChecker.approveRequest).not.toHaveBeenCalled();
    expect(aiSettings.upsert).not.toHaveBeenCalled();
  });

  it('applies the patch when a different approver accepts', async () => {
    const { service, aiSettings, makerChecker } = build({
      pendingRequest: {
        id: 'req-1',
        makerId: 'maker-1',
        requestData: { patch: { monthlyTokenBudget: 42, tutorEnabled: false } },
      },
    });
    const result = await service.approveChange({
      tenantId: 't1',
      userId: 'checker-9',
      profileId: 'p9',
      requestId: 'req-1',
      reason: 'ok',
    });
    expect(makerChecker.approveRequest).toHaveBeenCalled();
    expect(aiSettings.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { monthlyTokenBudget: 42, tutorEnabled: false },
      }),
    );
    expect(result).toMatchObject({ monthlyTokenBudget: 42, tutorEnabled: false });
  });

  it('404s when approving a request that is not pending for this tenant', async () => {
    const { service } = build({ pendingRequest: null });
    await expect(
      service.approveChange({
        tenantId: 't1',
        userId: 'checker-9',
        profileId: 'p9',
        requestId: 'missing',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects a pending change', async () => {
    const { service, makerChecker } = build({
      pendingRequest: {
        id: 'req-1',
        makerId: 'maker-1',
        requestData: { patch: {} },
      },
    });
    const res = await service.rejectChange({
      tenantId: 't1',
      userId: 'checker-9',
      requestId: 'req-1',
      reason: 'too costly',
    });
    expect(res).toEqual({ rejected: true });
    expect(makerChecker.rejectRequest).toHaveBeenCalledWith(
      expect.anything(),
      'req-1',
      'checker-9',
      'too costly',
    );
  });
});
