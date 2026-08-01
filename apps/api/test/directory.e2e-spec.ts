/**
 * Governed directory pattern (F7) — behavioural proof.
 *
 * Boots the real AppModule and exercises StudentDirectoryService +
 * SavedViewService on the app_runtime (RLS-enforcing) client. Proves:
 *   - the projection MASKS contact unless the caller holds the PII scope
 *     (unauthorized-scope) and returns it raw when they do
 *   - RLS isolates the projection: tenant B never sees tenant A's students
 *   - SavedView is RLS-isolated by tenant AND owner-scoped in the service
 *     (a personal view is invisible to another profile; a shared one is not),
 *     and a non-owner cannot mutate a view
 *   - the bulk export honours masking and returns the selected rows
 *
 * Requires APP_RUNTIME_DATABASE_URL (the restricted role). Skips otherwise —
 * without it the tenant client falls back to the privileged role and RLS is
 * bypassed, so the isolation assertions would be meaningless.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { AppModule } from '../src/app.module';
import { TenantDbService } from '../src/common';
import { StudentDirectoryService } from '../src/directory/services/student-directory.service';
import { SavedViewService } from '../src/directory/services/saved-view.service';
import type { AcademicsActor } from '../src/common/academics/academics-access.service';
import { makeSuperuserClient } from './helpers/superuser-client';

const HAS_APP_RUNTIME = !!process.env.APP_RUNTIME_DATABASE_URL;
const d = HAS_APP_RUNTIME ? describe : describe.skip;

interface CountRow {
  n: number;
}

function actor(profileId: string): AcademicsActor {
  return { userId: 'u', profileId, canViewAll: true, canManageAll: true };
}

d('Governed directory (F7)', () => {
  let app: INestApplication;
  let owner: ReturnType<typeof makeSuperuserClient>;
  let tenantDb: TenantDbService;
  let directory: StudentDirectoryService;
  let savedViews: SavedViewService;

  const stamp = Date.now();
  const A = `dir-a-${stamp}`;
  const B = `dir-b-${stamp}`;
  const studentEmail = `dir-stu-${stamp}@a.test`;
  let tenantAId: string;
  let tenantBId: string;
  let studentId: string;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();

    owner = makeSuperuserClient();
    tenantDb = app.get(TenantDbService);
    directory = app.get(StudentDirectoryService);
    savedViews = app.get(SavedViewService);

    const ta = await owner.tenant.create({
      data: { name: 'Dir A', slug: A, status: 'active' },
    });
    const tb = await owner.tenant.create({
      data: { name: 'Dir B', slug: B, status: 'active' },
    });
    tenantAId = ta.id;
    tenantBId = tb.id;

    // Minimal student in tenant A (User + UserTenant + Student).
    const user = await owner.user.create({
      data: { email: studentEmail, firstName: 'Ada', lastName: 'Okafor' },
    });
    const profile = await owner.userTenant.create({
      data: { userId: user.id, tenantId: tenantAId, status: 'active' },
    });
    const student = await owner.student.create({
      data: {
        tenantId: tenantAId,
        userTenantId: profile.id,
        studentNumber: `STU-${stamp}`,
        gradeLevel: 'SS1',
        enrollmentStatus: 'active',
      },
    });
    studentId = student.id;
  });

  afterAll(async () => {
    if (owner) {
      await owner.tenant.deleteMany({ where: { slug: { in: [A, B] } } });
      await owner.user.deleteMany({ where: { email: studentEmail } });
      await owner.$disconnect();
    }
    if (app) await app.close();
  });

  const inA = <T>(fn: () => Promise<T>) =>
    tenantDb.runScoped(tenantAId, undefined, fn);
  const inB = <T>(fn: () => Promise<T>) =>
    tenantDb.runScoped(tenantBId, undefined, fn);

  it('masks student contact unless the caller holds the PII scope', async () => {
    const masked = await inA(() =>
      directory.list(tenantAId, actor('p1'), false, {}),
    );
    const row = masked.data.find((r) => r.id === studentId);
    expect(row).toBeDefined();
    expect(row!.contactMasked).toBe(true);
    expect(row!.contact).not.toBe(studentEmail);

    const unmasked = await inA(() =>
      directory.list(tenantAId, actor('p1'), true, {}),
    );
    expect(unmasked.data.find((r) => r.id === studentId)!.contact).toBe(
      studentEmail,
    );
  });

  it('isolates the projection by tenant (RLS): B never sees A’s students', async () => {
    const fromB = await inB(() =>
      directory.list(tenantBId, actor('p1'), true, {}),
    );
    expect(fromB.data.find((r) => r.id === studentId)).toBeUndefined();
    expect(fromB.pagination.total).toBe(0);
  });

  it('exports the selected rows as CSV, honouring masking', async () => {
    const masked = await inA(() =>
      directory.export(tenantAId, 'u', false, [studentId]),
    );
    expect(masked.content).toContain(`STU-${stamp}`);
    expect(masked.content).not.toContain(studentEmail); // masked

    const raw = await inA(() =>
      directory.export(tenantAId, 'u', true, [studentId]),
    );
    expect(raw.content).toContain(studentEmail);
  });

  it('saved views: RLS-isolated by tenant and owner-scoped in the service', async () => {
    const personal = await inA(() =>
      savedViews.create(tenantAId, 'owner-1', 'u', {
        resource: 'students',
        name: 'My owing',
        state: { filters: { status: 'owing' } },
      }),
    );
    const shared = await inA(() =>
      savedViews.create(tenantAId, 'owner-1', 'u', {
        resource: 'students',
        name: 'Team SS1',
        state: { filters: { grade: 'SS1' } },
        isShared: true,
      }),
    );

    // Owner sees both; a different profile sees only the shared one.
    const asOwner = await inA(() =>
      savedViews.list(tenantAId, 'owner-1', 'students'),
    );
    expect(asOwner.map((v) => v.id).sort()).toEqual(
      [personal.id, shared.id].sort(),
    );
    const asOther = await inA(() =>
      savedViews.list(tenantAId, 'owner-2', 'students'),
    );
    expect(asOther.map((v) => v.id)).toEqual([shared.id]);

    // Tenant B sees none of A's views (RLS).
    const fromB = await inB(() =>
      savedViews.list(tenantBId, 'owner-1', 'students'),
    );
    expect(fromB).toHaveLength(0);
    const rawFromB = await inB(async () => {
      const rows = await tenantDb.client.$queryRaw<CountRow[]>`
        SELECT count(*)::int AS n FROM "directory"."saved_views" WHERE "id" = ${personal.id}`;
      return rows[0].n;
    });
    expect(rawFromB).toBe(0);

    // A non-owner cannot mutate the view.
    await expect(
      inA(() =>
        savedViews.update(tenantAId, 'owner-2', 'u', personal.id, {
          name: 'x',
        }),
      ),
    ).rejects.toThrow();
  });
});
