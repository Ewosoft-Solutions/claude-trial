/**
 * Time-boxed + scoped access grants with maker-checker (WB1-6) — behavioural
 * proof on the app_runtime (RLS-enforcing) client.
 *
 * Acceptance (workbench-1 scenarios 2-4):
 *   - a LOW-risk grant applies immediately
 *   - a HIGH-risk grant (sensitive role) does NOT apply — it raises a
 *     maker-checker request; the maker can't approve their own (separation of
 *     duties); a SECOND approver applies it (scenario 4)
 *   - a time-boxed grant AUTO-EXPIRES: once past, the live permission context
 *     resolves to "no active role" and access is denied (scenario 3)
 *   - a campus-scoped actor can't grant OUTSIDE their campus; within it succeeds
 *     (scenario 2, enforcement primitive)
 *   - RLS hides another tenant's profile; the HTTP guard stack rejects anon
 *
 * Requires APP_RUNTIME_DATABASE_URL (the restricted role). Skips otherwise —
 * without it RLS is bypassed and the isolation assertions are meaningless.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, INestApplication } from '@nestjs/common';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';

import { PrismaClient } from '@workspace/database';

import { AppModule } from '../src/app.module';
import { TenantDbService } from '../src/common';
import { TENANT_PRISMA_CLIENT_TOKEN } from '../src/common/database/database.service';
import { AccessGrantService } from '../src/access/services/access-grant.service';
import { PermissionService } from '../src/auth/services/permission.service';
import { makeSuperuserClient } from './helpers/superuser-client';

const HAS_APP_RUNTIME = !!process.env.APP_RUNTIME_DATABASE_URL;
const d = HAS_APP_RUNTIME ? describe : describe.skip;

d('Access grants — scope + expiry + maker-checker (WB1-6)', () => {
  let app: INestApplication;
  let owner: ReturnType<typeof makeSuperuserClient>;
  let tenantDb: TenantDbService;
  let appRuntime: PrismaClient;
  let grants: AccessGrantService;
  let permissions: PermissionService;

  const stamp = Date.now();
  const A = `acc-a-${stamp}`;
  const B = `acc-b-${stamp}`;
  const makerEmail = `acc-maker-${stamp}@a.test`;
  const checkerEmail = `acc-checker-${stamp}@a.test`;
  const subEmail = `acc-sub-${stamp}@a.test`;
  const sub2Email = `acc-sub2-${stamp}@a.test`;
  const poolLow = `WB16_Low_${stamp}`;
  const poolHigh = `WB16_High_${stamp}`;
  const lowPerm = `wb16.fees.view.${stamp}`;
  const highPerm = `wb16.payments.export.${stamp}`;

  let tenantAId: string;
  let tenantBId: string;
  let makerId: string;
  let checkerId: string;
  let campus1Id: string;
  let campus2Id: string;
  let subProfileId: string; // target for maker-checker + scope tests
  let subUserId: string;
  let sub2ProfileId: string; // target for the expiry test
  let sub2UserId: string;
  let lowRoleId: string;
  let highRoleId: string;

  const inA = <T>(fn: () => Promise<T>) =>
    tenantDb.runScoped(tenantAId, makerId, fn);
  const inB = <T>(fn: () => Promise<T>) =>
    tenantDb.runScoped(tenantBId, makerId, fn);

  const maker = () => ({ userId: makerId, clearanceLevel: 8 });

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();

    owner = makeSuperuserClient();
    tenantDb = app.get(TenantDbService);
    appRuntime = app.get<PrismaClient>(TENANT_PRISMA_CLIENT_TOKEN);
    grants = app.get(AccessGrantService);
    permissions = app.get(PermissionService);

    const [ta, tb] = await Promise.all([
      owner.tenant.create({ data: { name: 'Acc A', slug: A, status: 'active' } }),
      owner.tenant.create({ data: { name: 'Acc B', slug: B, status: 'active' } }),
    ]);
    tenantAId = ta.id;
    tenantBId = tb.id;

    const [makerUser, checkerUser, subUser, sub2User] = await Promise.all([
      owner.user.create({ data: { email: makerEmail, isActive: true } }),
      owner.user.create({ data: { email: checkerEmail, isActive: true } }),
      owner.user.create({ data: { email: subEmail, isActive: true } }),
      owner.user.create({ data: { email: sub2Email, isActive: true } }),
    ]);
    makerId = makerUser.id;
    checkerId = checkerUser.id;
    subUserId = subUser.id;
    sub2UserId = sub2User.id;

    // Two campuses in tenant A (the scope targets).
    const [c1, c2] = await Promise.all([
      owner.campus.create({
        data: { tenantId: tenantAId, name: 'Main', code: 'MAIN', isPrimary: true },
      }),
      owner.campus.create({
        data: { tenantId: tenantAId, name: 'Annex', code: 'ANNEX' },
      }),
    ]);
    campus1Id = c1.id;
    campus2Id = c2.id;

    // Two substitute profiles with NO role yet (grants target them).
    const [subUt, sub2Ut] = await Promise.all([
      owner.userTenant.create({
        data: { userId: subUserId, tenantId: tenantAId, status: 'active' },
      }),
      owner.userTenant.create({
        data: { userId: sub2UserId, tenantId: tenantAId, status: 'active' },
      }),
    ]);
    subProfileId = subUt.id;
    sub2ProfileId = sub2Ut.id;

    // Catalog permissions — uniquely named (per stamp) so we own their clearance
    // regardless of the seeded catalog: one benign 'view', one sensitive 'export'
    // (the effective-access evaluator flags 'export' as a sensitive action).
    const permDefs = [
      { name: lowPerm, action: 'view', clr: 3 },
      { name: highPerm, action: 'export', clr: 4 },
    ];
    const permIds: Record<string, string> = {};
    for (const p of permDefs) {
      const row = await owner.permission.create({
        data: {
          name: p.name,
          label: p.name,
          resource: 'wb16',
          action: p.action,
          category: 'financial',
          requiredClearanceLevel: p.clr,
        },
        select: { id: true },
      });
      permIds[p.name] = row.id;
    }

    // Low pool (clr 3, benign) + high pool (clr 5, sensitive export).
    const [low, high] = await Promise.all([
      owner.permissionPool.create({
        data: { name: poolLow, clearanceLevel: 3, isSystemPool: true, tenantId: null },
        select: { id: true },
      }),
      owner.permissionPool.create({
        data: { name: poolHigh, clearanceLevel: 5, isSystemPool: true, tenantId: null },
        select: { id: true },
      }),
    ]);
    await owner.permissionPoolPermission.createMany({
      data: [
        { poolId: low.id, permissionId: permIds[lowPerm]! },
        { poolId: high.id, permissionId: permIds[highPerm]! },
      ],
    });

    // A low-risk custom role (clr 3) and a high-risk one (clr 5, sensitive).
    const [lowRole, highRole] = await Promise.all([
      owner.role.create({
        data: {
          name: `WB16 Low ${stamp}`,
          roleType: 'custom',
          clearanceLevel: 3,
          tenantId: tenantAId,
          isActive: true,
          isSystemRole: false,
        },
        select: { id: true },
      }),
      owner.role.create({
        data: {
          name: `WB16 High ${stamp}`,
          roleType: 'custom',
          clearanceLevel: 5,
          tenantId: tenantAId,
          isActive: true,
          isSystemRole: false,
        },
        select: { id: true },
      }),
    ]);
    lowRoleId = lowRole.id;
    highRoleId = highRole.id;
    await owner.rolePermissionPool.createMany({
      data: [
        { roleId: lowRoleId, poolId: low.id },
        { roleId: highRoleId, poolId: high.id },
      ],
    });
  });

  afterAll(async () => {
    if (owner) {
      await owner.userTenantRole.deleteMany({
        where: { userTenant: { tenantId: { in: [tenantAId, tenantBId] } } },
      });
      await owner.makerCheckerRequest.deleteMany({
        where: { tenantId: tenantAId, operation: 'access.grant.high_risk' },
      });
      await owner.role.deleteMany({ where: { tenantId: tenantAId } });
      await owner.permissionPool.deleteMany({
        where: { name: { in: [poolLow, poolHigh] } },
      });
      await owner.permission.deleteMany({
        where: { name: { in: [lowPerm, highPerm] } },
      });
      await owner.userTenant.deleteMany({
        where: { tenantId: { in: [tenantAId, tenantBId] } },
      });
      await owner.campus.deleteMany({ where: { tenantId: tenantAId } });
      await owner.tenant.deleteMany({ where: { slug: { in: [A, B] } } });
      await owner.user.deleteMany({
        where: { email: { in: [makerEmail, checkerEmail, subEmail, sub2Email] } },
      });
      await owner.$disconnect();
    }
    if (app) await app.close();
  });

  it('applies a LOW-risk grant immediately', async () => {
    const out = await inA(() =>
      grants.requestGrant(tenantAId, maker(), {
        profileId: subProfileId,
        roleId: lowRoleId,
      }),
    );
    expect(out).toMatchObject({ status: 'active', roleId: lowRoleId });

    const row = await owner.userTenantRole.findUnique({
      where: { userTenantId: subProfileId },
      select: { roleId: true },
    });
    expect(row?.roleId).toBe(lowRoleId);
  });

  it('routes a HIGH-risk grant to maker-checker and does NOT apply it', async () => {
    const out = await inA(() =>
      grants.requestGrant(tenantAId, maker(), {
        profileId: subProfileId,
        roleId: highRoleId,
        reason: 'payroll cover',
      }),
    );
    expect(out).toMatchObject({ status: 'pending_approval' });

    // The active role is still the low one — the high grant is pending.
    const row = await owner.userTenantRole.findUnique({
      where: { userTenantId: subProfileId },
      select: { roleId: true },
    });
    expect(row?.roleId).toBe(lowRoleId);

    const pending = await owner.makerCheckerRequest.findMany({
      where: {
        tenantId: tenantAId,
        operation: 'access.grant.high_risk',
        status: 'pending',
      },
    });
    expect(pending.length).toBe(1);
    expect(pending[0]!.makerId).toBe(makerId);
  });

  it('denies the MAKER approving their own request; a SECOND approver applies it', async () => {
    const req = await owner.makerCheckerRequest.findFirst({
      where: { tenantId: tenantAId, operation: 'access.grant.high_risk', status: 'pending' },
      select: { id: true },
    });
    const requestId = req!.id;

    // Separation of duties: the maker cannot approve their own request.
    await expect(
      inA(() => grants.approveGrant(tenantAId, maker(), requestId)),
    ).rejects.toBeInstanceOf(ForbiddenException);

    // Still pending, still the low role.
    const stillLow = await owner.userTenantRole.findUnique({
      where: { userTenantId: subProfileId },
      select: { roleId: true },
    });
    expect(stillLow?.roleId).toBe(lowRoleId);

    // A different approver (clearance 7) signs off → the grant is applied.
    const out = await tenantDb.runScoped(tenantAId, checkerId, () =>
      grants.approveGrant(
        tenantAId,
        { userId: checkerId, clearanceLevel: 7 },
        requestId,
      ),
    );
    expect(out).toMatchObject({ status: 'active' });

    const nowHigh = await owner.userTenantRole.findUnique({
      where: { userTenantId: subProfileId },
      select: { roleId: true },
    });
    expect(nowHigh?.roleId).toBe(highRoleId);

    const closed = await owner.makerCheckerRequest.findUnique({
      where: { id: requestId },
      select: { status: true, checkerId: true },
    });
    expect(closed?.status).toBe('approved');
    expect(closed?.checkerId).toBe(checkerId);
  });

  it('auto-expires a time-boxed grant: the live permission context loses the role once past', async () => {
    // Grant the low role to sub2 with a FUTURE expiry.
    await inA(() =>
      grants.requestGrant(tenantAId, maker(), {
        profileId: sub2ProfileId,
        roleId: lowRoleId,
        expiresAt: new Date(Date.now() + 5 * 24 * 3600_000).toISOString(),
        reason: '5-day substitute cover',
      }),
    );

    // While active, the permission context resolves and carries fees.view.
    const active = await permissions.getUserPermissionContext(
      appRuntime,
      sub2UserId,
      tenantAId,
      sub2ProfileId,
    );
    expect(active).not.toBeNull();
    expect(active!.permissions.has(lowPerm)).toBe(true);

    // Move the expiry into the past (as the substitute cover ends).
    await owner.userTenantRole.update({
      where: { userTenantId: sub2ProfileId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    // The very next authorization decision resolves to "no active role".
    const expired = await permissions.getUserPermissionContext(
      appRuntime,
      sub2UserId,
      tenantAId,
      sub2ProfileId,
    );
    expect(expired).toBeNull();
  });

  it('enforces campus scope: a Campus-1 actor cannot grant into Campus-2, but can within Campus-1', async () => {
    const campus1Actor = {
      userId: makerId,
      clearanceLevel: 7,
      grantScope: { type: 'campus', value: campus1Id, label: 'Main' },
    };

    // Out of scope → denied.
    await expect(
      inA(() =>
        grants.requestGrant(tenantAId, campus1Actor, {
          profileId: sub2ProfileId,
          roleId: lowRoleId,
          scope: { type: 'campus', value: campus2Id },
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    // Within scope → applied, and the grant carries the resolved campus scope.
    const out = await inA(() =>
      grants.requestGrant(tenantAId, campus1Actor, {
        profileId: sub2ProfileId,
        roleId: lowRoleId,
        scope: { type: 'campus', value: campus1Id },
      }),
    );
    expect(out).toMatchObject({ status: 'active' });

    const row = await owner.userTenantRole.findUnique({
      where: { userTenantId: sub2ProfileId },
      select: { scope: true },
    });
    expect(row?.scope).toMatchObject({ type: 'campus', value: campus1Id });
  });

  it('RLS hides another tenant’s profile from the grant surface', async () => {
    await expect(inB(() => grants.getState(tenantBId, subProfileId))).rejects.toThrow();
  });

  it('rejects unauthenticated access-grant calls at the HTTP boundary', async () => {
    const http = app.getHttpServer();
    await request(http).get(`/access/profiles/${subProfileId}/grants`).expect(401);
    await request(http).post('/access/grants').send({}).expect(401);
    await request(http).get('/campuses').expect(401);
  });
});
