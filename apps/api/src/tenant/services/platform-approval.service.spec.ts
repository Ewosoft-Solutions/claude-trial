/**
 * PlatformApprovalService — "SuperAdmin proposes, Architect disposes".
 *
 * The routing is the behaviour under test: an Architect's action applies
 * immediately; a SuperAdmin's is held pending. Approval then executes the
 * deferred change.
 */
import { MakerCheckerService } from '../../auth/services/maker-checker.service';
import { PlatformApprovalService } from './platform-approval.service';

const ARCHITECT = {
  userId: 'arch',
  tenantId: 'platform',
  clearanceLevel: 10,
  canOverride: true,
};
const SUPERADMIN = {
  userId: 'super',
  tenantId: 'platform',
  clearanceLevel: 9,
  canOverride: false,
};

function build(tenantStatus = 'active') {
  const tenant = {
    findUnique: jest.fn().mockResolvedValue({ id: 't1', status: tenantStatus }),
    update: jest.fn().mockResolvedValue({ id: 't1' }),
  };
  const makerCheckerRequest = {
    create: jest.fn().mockResolvedValue({ id: 'req-99' }),
    findUnique: jest.fn(),
  };
  const client = { tenant, makerCheckerRequest };

  // TenantDbService stand-in: `client` returns the fake, runPlatform runs inline.
  const tenantDb = { client };

  const platformAudit = {
    logTenantStatusAction: jest.fn().mockResolvedValue(undefined),
  };

  // Real MakerCheckerService — we want its actual clearance/self-approval logic.
  const makerChecker = new MakerCheckerService();

  const service = new PlatformApprovalService(
    tenantDb as never,
    makerChecker,
    platformAudit as never,
  );

  return { service, tenant, makerCheckerRequest, platformAudit, makerChecker };
}

describe('PlatformApprovalService.submitTenantStatusChange', () => {
  it('applies immediately for an Architect', async () => {
    const { service, tenant, makerCheckerRequest, platformAudit } =
      build('active');

    const res = await service.submitTenantStatusChange({
      actor: ARCHITECT,
      targetTenantId: 't1',
      status: 'suspended',
    });

    expect(res).toEqual({ outcome: 'applied' });
    expect(tenant.update).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: { status: 'suspended' },
    });
    expect(makerCheckerRequest.create).not.toHaveBeenCalled();
    expect(platformAudit.logTenantStatusAction).toHaveBeenCalledWith(
      expect.objectContaining({ targetTenantId: 't1', status: 'suspended' }),
    );
  });

  it('holds a SuperAdmin action as pending, not applied', async () => {
    const { service, tenant, makerCheckerRequest } = build('active');

    const res = await service.submitTenantStatusChange({
      actor: SUPERADMIN,
      targetTenantId: 't1',
      status: 'suspended',
      reason: 'overdue invoice',
    });

    expect(res).toEqual({ outcome: 'pending', requestId: 'req-99' });
    // The change must NOT have taken effect yet — that is the whole point.
    expect(tenant.update).not.toHaveBeenCalled();
    expect(makerCheckerRequest.create).toHaveBeenCalledTimes(1);
  });

  it('rejects a no-op transition before creating any request', async () => {
    const { service, makerCheckerRequest } = build('suspended');

    await expect(
      service.submitTenantStatusChange({
        actor: SUPERADMIN,
        targetTenantId: 't1',
        status: 'suspended',
      }),
    ).rejects.toThrow(/already suspended/i);
    expect(makerCheckerRequest.create).not.toHaveBeenCalled();
  });
});

describe('PlatformApprovalService.approve', () => {
  it('executes the deferred change when an Architect approves a SuperAdmin request', async () => {
    const { service, tenant, makerCheckerRequest } = build('active');
    makerCheckerRequest.findUnique.mockResolvedValue({
      id: 'req-99',
      operation: 'tenant.act',
      status: 'pending',
      makerId: 'super',
      expiresAt: null,
      requestData: { targetTenantId: 't1', status: 'suspended' },
    });
    makerCheckerRequest.update = jest.fn().mockResolvedValue({});

    const res = await service.approve({ actor: ARCHITECT, requestId: 'req-99' });

    expect(res).toEqual({ status: 'suspended', targetTenantId: 't1' });
    expect(tenant.update).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: { status: 'suspended' },
    });
  });

  it('does not execute if the maker tries to approve their own request', async () => {
    const { service, tenant, makerCheckerRequest } = build('active');
    makerCheckerRequest.findUnique.mockResolvedValue({
      id: 'req-99',
      operation: 'tenant.act',
      status: 'pending',
      makerId: 'super',
      expiresAt: null,
      requestData: { targetTenantId: 't1', status: 'suspended' },
    });
    makerCheckerRequest.update = jest.fn();

    await expect(
      service.approve({
        actor: { ...SUPERADMIN, userId: 'super' },
        requestId: 'req-99',
      }),
    ).rejects.toThrow(/cannot approve your own request/i);
    expect(tenant.update).not.toHaveBeenCalled();
  });
});
