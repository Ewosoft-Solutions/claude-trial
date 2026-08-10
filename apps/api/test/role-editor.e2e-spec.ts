/**
 * Role editor + effective-access evaluator (WB1-5) — behavioural proof on the
 * app_runtime (RLS-enforcing) client.
 *
 * Acceptance:
 *   - a template resolves its permission-pool names to pool ids for the tenant
 *   - a custom role built from a template persists its scope + template key
 *   - the evaluator explains effective access: the matrix (each permission with
 *     its SOURCE pool), sensitive capabilities, and separation-of-duties
 *     conflicts
 *   - explain(): allowed for a permission in scope, DENIED out of scope
 *   - who's-affected lists the profiles holding the role
 *   - RLS hides another tenant's role; the HTTP guard stack rejects unauthenticated
 *
 * Requires APP_RUNTIME_DATABASE_URL. Uses upsert-by-name for the shared
 * permission catalog so it is safe against a seeded (dev) or fresh (CI) DB.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, NotFoundException } from '@nestjs/common';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { PrismaClient } from '@workspace/database';

import { AppModule } from '../src/app.module';
import { TENANT_PRISMA_CLIENT_TOKEN } from '../src/common/database/database.service';
import { RoleService } from '../src/auth/services/role.service';
import { RoleTemplateService } from '../src/auth/services/role-template.service';
import { EffectiveAccessService } from '../src/auth/services/effective-access.service';
import { makeSuperuserClient } from './helpers/superuser-client';

const HAS_APP_RUNTIME = !!process.env.APP_RUNTIME_DATABASE_URL;
const d = HAS_APP_RUNTIME ? describe : describe.skip;

d('Role editor + effective access (WB1-5)', () => {
  let app: INestApplication;
  let owner: ReturnType<typeof makeSuperuserClient>;
  let appRuntime: PrismaClient;
  let roleService: RoleService;
  let templates: RoleTemplateService;
  let effective: EffectiveAccessService;

  const stamp = Date.now();
  const A = `role-a-${stamp}`;
  const B = `role-b-${stamp}`;
  const poolName = `WB15_Finance_${stamp}`;
  const templateKey = `wb15-bursar-${stamp}`;

  let tenantAId: string;
  let tenantBId: string;
  let actorId: string;
  let poolId: string;
  let roleId: string;
  let campusAId: string;

  // Real permission names so sensitive/SoD detection is meaningful; upserted so
  // the suite is safe whether or not the catalog is already seeded.
  const PERMS = [
    { name: 'fees.view', action: 'view', clr: 4 },
    { name: 'fees.create', action: 'create', clr: 5 },
    { name: 'fees.export', action: 'export', clr: 4 },
    { name: 'payments.refund', action: 'refund', clr: 5 },
  ];

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();

    owner = makeSuperuserClient();
    appRuntime = app.get<PrismaClient>(TENANT_PRISMA_CLIENT_TOKEN);
    roleService = app.get(RoleService);
    templates = app.get(RoleTemplateService);
    effective = app.get(EffectiveAccessService);

    const [ta, tb] = await Promise.all([
      owner.tenant.create({
        data: { name: 'Role A', slug: A, status: 'active' },
      }),
      owner.tenant.create({
        data: { name: 'Role B', slug: B, status: 'active' },
      }),
    ]);
    tenantAId = ta.id;
    tenantBId = tb.id;

    // A real campus of tenant A — role scopes must reference an actual campus
    // id (validated in createCustomRole), never an arbitrary label.
    const campusA = await owner.campus.create({
      data: { tenantId: tenantAId, name: 'Campus A', code: `CAMP-A-${stamp}` },
      select: { id: true },
    });
    campusAId = campusA.id;

    const actor = await owner.user.create({
      data: { email: `role-actor-${stamp}@a.test`, isActive: true },
    });
    actorId = actor.id;

    // Catalog permissions (upsert by unique name).
    const permIds: string[] = [];
    for (const p of PERMS) {
      const row = await owner.permission.upsert({
        where: { name: p.name },
        update: {},
        create: {
          name: p.name,
          label: p.name,
          resource: p.name.split('.')[0]!,
          action: p.action,
          category: 'financial',
          requiredClearanceLevel: p.clr,
        },
        select: { id: true },
      });
      permIds.push(row.id);
    }

    // A shared (system) pool at clearance 5 granting those permissions.
    const pool = await owner.permissionPool.create({
      data: {
        name: poolName,
        clearanceLevel: 5,
        description: 'WB1-5 e2e finance pool',
        isSystemPool: true,
        tenantId: null,
      },
      select: { id: true },
    });
    poolId = pool.id;
    await owner.permissionPoolPermission.createMany({
      data: permIds.map((permissionId) => ({ poolId, permissionId })),
    });

    // A shared system template referencing the pool by name.
    await owner.roleTemplate.create({
      data: {
        tenantId: null,
        key: templateKey,
        name: `WB15 Bursar ${stamp}`,
        description: 'Finance office',
        category: 'Finance',
        clearanceLevel: 5,
        permissionPoolNames: [poolName],
        sensitive: true,
        isSystemTemplate: true,
      },
    });
  });

  afterAll(async () => {
    if (owner) {
      await owner.roleTemplate.deleteMany({ where: { key: templateKey } });
      await owner.permissionPool.deleteMany({ where: { id: poolId } }); // cascades links
      await owner.tenant.deleteMany({ where: { slug: { in: [A, B] } } });
      await owner.user.deleteMany({
        where: { email: { in: [`role-actor-${stamp}@a.test`] } },
      });
      await owner.$disconnect();
    }
    if (app) await app.close();
  });

  it('resolves a template’s pool names to pool ids for the tenant', async () => {
    const list = await templates.list(appRuntime, tenantAId);
    const mine = list.find((t) => t.key === templateKey);
    expect(mine).toBeDefined();
    expect(mine!.poolIds).toContain(poolId);
    expect(mine!.unresolvedPools).toHaveLength(0);
    expect(mine!.sensitive).toBe(true);
  });

  it('builds a scoped role from the template and persists scope + template key', async () => {
    const result = await roleService.createCustomRole(appRuntime, {
      name: `WB15 Bursar (Campus A) ${stamp}`,
      clearanceLevel: 5,
      tenantId: tenantAId,
      permissionPoolIds: [poolId],
      createdBy: actorId,
      creatorClearanceLevel: 8,
      templateKey,
      scope: { type: 'campus', value: campusAId, label: 'Campus A' },
    });
    roleId = result.role.id;

    const row = await owner.role.findUnique({
      where: { id: roleId },
      select: { scope: true, templateKey: true, clearanceLevel: true },
    });
    expect(row?.templateKey).toBe(templateKey);
    expect(row?.scope).toMatchObject({ type: 'campus', value: campusAId });
  });

  it('explains effective access: matrix + source pool + sensitive + SoD', async () => {
    const access = await effective.evaluateRole(appRuntime, tenantAId, roleId);
    const names = access.entries.map((e) => e.permission);
    expect(names).toEqual(expect.arrayContaining(['fees.view', 'fees.create']));
    // every entry attributes the source pool
    expect(access.entries.every((e) => e.sourcePool === poolName)).toBe(true);
    // sensitive: refund + export
    expect(new Set(access.sensitive)).toEqual(
      new Set(['payments.refund', 'fees.export']),
    );
    // SoD: raising charges + refunding
    expect(
      access.conflicts.some(
        (c) => c.a === 'fees.create' && c.b === 'payments.refund',
      ),
    ).toBe(true);
    expect(access.scope).toMatchObject({ label: 'Campus A' });
  });

  it('explain(): allowed for a permission in scope, denied out of scope', async () => {
    const inScope = await effective.explainRole(appRuntime, tenantAId, roleId, {
      permission: 'fees.view',
      targetScope: { type: 'campus', value: campusAId, label: 'Campus A' },
    });
    expect(inScope.allowed).toBe(true);
    expect(inScope.sourcePool).toBe(poolName);

    const outOfScope = await effective.explainRole(
      appRuntime,
      tenantAId,
      roleId,
      {
        permission: 'fees.view',
        targetScope: { type: 'campus', value: 'campus-b', label: 'Campus B' },
      },
    );
    expect(outOfScope.allowed).toBe(false);
    expect(outOfScope.reason).toMatch(/Campus A.*not.*Campus B/);
  });

  it('who’s-affected lists profiles holding the role', async () => {
    const member = await owner.user.create({
      data: { email: `role-member-${stamp}@a.test`, isActive: true },
    });
    const ut = await owner.userTenant.create({
      data: { userId: member.id, tenantId: tenantAId, status: 'active' },
    });
    await owner.userTenantRole.create({
      data: { userTenantId: ut.id, roleId, tenantId: tenantAId },
    });

    const affected = await effective.whoIsAffected(
      appRuntime,
      tenantAId,
      roleId,
    );
    expect(affected.count).toBe(1);
    expect(affected.profiles[0]!.userTenantId).toBe(ut.id);

    await owner.user.deleteMany({
      where: { email: `role-member-${stamp}@a.test` },
    });
  });

  it('RLS hides another tenant’s role from the evaluator', async () => {
    await expect(
      effective.evaluateRole(appRuntime, tenantBId, roleId),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects an unauthenticated effective-access call at the boundary', async () => {
    const http = app.getHttpServer();
    await request(http).get('/roles/templates').expect(401);
    await request(http).get(`/roles/${roleId}/effective-access`).expect(401);
  });
});
