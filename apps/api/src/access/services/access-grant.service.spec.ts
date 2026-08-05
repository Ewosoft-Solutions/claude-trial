import { ForbiddenException } from '@nestjs/common';
import { AccessScopeService } from '../../auth/services/access-scope.service';
import { AccessGrantService, type GrantActor } from './access-grant.service';

/**
 * Unit coverage for the WB1-6 grant router: high-risk grants go to maker-checker
 * (never applied directly), low-risk grants apply immediately, and the actor's
 * own clearance + campus scope bound what they can grant. The full expiry +
 * second-approver + RLS path is proven end-to-end in the e2e spec on real pg.
 */
function makeService(opts?: {
  sensitive?: string[];
  roleClearance?: number;
}) {
  const userTenantFindFirst = jest.fn().mockResolvedValue({
    id: 'profile-1',
    user: { email: 'sub@school.test', firstName: 'Sub', lastName: 'Teacher' },
    userTenantRole: null,
  });
  const roleFindFirst = jest.fn().mockResolvedValue({
    id: 'role-1',
    name: 'Substitute Teacher',
    clearanceLevel: opts?.roleClearance ?? 3,
  });
  const campusFindFirst = jest
    .fn()
    .mockResolvedValue({ id: 'campus-b', name: 'Annex' });
  const upsert = jest.fn().mockResolvedValue({});
  const del = jest.fn().mockResolvedValue({});
  const mcFindFirst = jest.fn();
  const client = {
    userTenant: { findFirst: userTenantFindFirst },
    role: { findFirst: roleFindFirst },
    campus: { findFirst: campusFindFirst },
    userTenantRole: { upsert, delete: del },
    makerCheckerRequest: { findFirst: mcFindFirst, findMany: jest.fn() },
  };
  const write = jest.fn().mockResolvedValue(true);
  const evaluateRole = jest
    .fn()
    .mockResolvedValue({ sensitive: opts?.sensitive ?? [] });
  const createApprovalRequest = jest.fn().mockResolvedValue('req-1');
  const approveRequest = jest.fn();
  const rejectRequest = jest.fn();

  const service = new AccessGrantService(
    { client } as never,
    { write } as never,
    { evaluateRole } as never,
    { createApprovalRequest, approveRequest, rejectRequest } as never,
    new AccessScopeService(),
  );
  return {
    service,
    upsert,
    write,
    evaluateRole,
    createApprovalRequest,
    approveRequest,
    rejectRequest,
    campusFindFirst,
    mcFindFirst,
  };
}

const PENDING_REQUEST = {
  id: 'req-1',
  tenantId: 't1',
  operation: 'access.grant.high_risk',
  status: 'pending',
  makerId: 'maker-1',
  requestData: {
    profileId: 'profile-1',
    roleId: 'role-1',
    scope: null,
    expiresAt: null,
    reason: null,
  },
};

const owner: GrantActor = { userId: 'owner-1', clearanceLevel: 8 };

describe('AccessGrantService.requestGrant', () => {
  it('applies a LOW-risk grant immediately (no maker-checker)', async () => {
    const t = makeService({ sensitive: [], roleClearance: 3 });
    const out = await t.service.requestGrant('t1', owner, {
      profileId: 'profile-1',
      roleId: 'role-1',
    });
    expect(out).toEqual({
      status: 'active',
      profileId: 'profile-1',
      roleId: 'role-1',
    });
    expect(t.upsert).toHaveBeenCalledTimes(1);
    expect(t.createApprovalRequest).not.toHaveBeenCalled();
  });

  it('routes a HIGH-risk grant (sensitive role) to maker-checker and does NOT apply it', async () => {
    const t = makeService({ sensitive: ['payments.export'], roleClearance: 5 });
    const out = await t.service.requestGrant('t1', owner, {
      profileId: 'profile-1',
      roleId: 'role-1',
    });
    expect(out).toEqual({ status: 'pending_approval', approvalRequestId: 'req-1' });
    expect(t.createApprovalRequest).toHaveBeenCalledTimes(1);
    expect(t.upsert).not.toHaveBeenCalled();
  });

  it('treats a clearance-7 role as HIGH-risk even without a sensitive flag', async () => {
    const t = makeService({ sensitive: [], roleClearance: 7 });
    const out = await t.service.requestGrant('t1', owner, {
      profileId: 'profile-1',
      roleId: 'role-1',
    });
    expect(out).toMatchObject({ status: 'pending_approval' });
    expect(t.upsert).not.toHaveBeenCalled();
  });

  it('refuses to grant a role above the actor’s own clearance', async () => {
    const t = makeService({ roleClearance: 7 });
    const junior: GrantActor = { userId: 'j1', clearanceLevel: 5 };
    await expect(
      t.service.requestGrant('t1', junior, {
        profileId: 'profile-1',
        roleId: 'role-1',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('refuses a campus-scoped actor granting OUTSIDE their campus', async () => {
    const t = makeService({ roleClearance: 3 });
    // Actor is scoped to Campus A; the grant targets Campus B (campusFindFirst).
    const scopedActor: GrantActor = {
      userId: 'a1',
      clearanceLevel: 7,
      grantScope: { type: 'campus', value: 'campus-a', label: 'Campus A' },
    };
    await expect(
      t.service.requestGrant('t1', scopedActor, {
        profileId: 'profile-1',
        roleId: 'role-1',
        scope: { type: 'campus', value: 'campus-b' },
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(t.upsert).not.toHaveBeenCalled();
  });
});

describe('AccessGrantService.approveGrant', () => {
  it('applies the grant when a SECOND approver signs off (maker ≠ checker)', async () => {
    const t = makeService();
    t.mcFindFirst.mockResolvedValue(PENDING_REQUEST);
    t.approveRequest.mockResolvedValue({ approved: true });

    const out = await t.service.approveGrant(
      't1',
      { userId: 'checker-2', clearanceLevel: 7 },
      'req-1',
    );
    expect(out).toEqual({ status: 'active', profileId: 'profile-1' });
    // Second approver's userId is passed to the maker-checker (which enforces
    // maker ≠ checker) and the grant is then applied.
    expect(t.approveRequest.mock.calls[0][2]).toBe('checker-2');
    expect(t.upsert).toHaveBeenCalledTimes(1);
  });

  it('is denied when the maker tries to approve their OWN request (separation of duties)', async () => {
    const t = makeService();
    t.mcFindFirst.mockResolvedValue(PENDING_REQUEST);
    // MakerCheckerService refuses self-approval.
    t.approveRequest.mockResolvedValue({
      approved: false,
      error: 'You cannot approve your own request',
    });

    await expect(
      t.service.approveGrant(
        't1',
        { userId: 'maker-1', clearanceLevel: 7 },
        'req-1',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(t.upsert).not.toHaveBeenCalled();
  });
});
