/**
 * Curriculum — academic-profile + policy-version framework (F6 / ADR-03) —
 * behavioural proof. Boots the real AppModule and exercises the curriculum
 * services on the app_runtime (RLS-enforcing) client. Proves the ADR-03
 * acceptance criteria:
 *   - two cohorts at ONE campus run DIFFERENT versions simultaneously, and a
 *     prior version is unaffected when a new version activates (immutability)
 *   - an AI-authored node cannot be published without a named reviewer
 *   - national content (tenant_id NULL) is READABLE by any tenant but IMMUTABLE
 *     to it (edits must go through an overlay); a tenant's own version is not
 *     visible to another tenant (RLS)
 *   - a dirty legacy subject name resolves to a canonical subject via an alias
 *
 * Requires APP_RUNTIME_DATABASE_URL; skips otherwise.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ForbiddenException } from '@nestjs/common';
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from '@jest/globals';
import { AppModule } from '../src/app.module';
import { TenantDbService } from '../src/common';
import { CurriculumService } from '../src/curriculum/services/curriculum.service';
import { CurriculumAdoptionService } from '../src/curriculum/services/curriculum-adoption.service';
import { CurriculumOverlayService } from '../src/curriculum/services/curriculum-overlay.service';
import { CurriculumMappingService } from '../src/curriculum/services/curriculum-mapping.service';
import { makeSuperuserClient } from './helpers/superuser-client';

const HAS_APP_RUNTIME = !!process.env.APP_RUNTIME_DATABASE_URL;
const d = HAS_APP_RUNTIME ? describe : describe.skip;

d('Curriculum framework (F6)', () => {
  let app: INestApplication;
  let owner: ReturnType<typeof makeSuperuserClient>;
  let tenantDb: TenantDbService;
  let curriculum: CurriculumService;
  let adoptions: CurriculumAdoptionService;
  let overlays: CurriculumOverlayService;
  let mappings: CurriculumMappingService;

  const A = `curr-a-${Date.now()}`;
  const B = `curr-b-${Date.now()}`;
  let tenantAId: string;
  let tenantBId: string;
  let nationalVersionId: string;

  const scopedA = <T>(fn: () => Promise<T>) =>
    tenantDb.runScoped(tenantAId, 'actor-a', fn);
  const scopedB = <T>(fn: () => Promise<T>) =>
    tenantDb.runScoped(tenantBId, 'actor-b', fn);

  // Build an activated tenant-A framework + version with one subject.
  const makeActiveVersion = async (label: string, effectiveFrom: string) => {
    const authority = await curriculum.createAuthority(tenantAId, 'actor-a', {
      name: `Board ${label}`,
      code: `BRD-${label}`,
    });
    const framework = await curriculum.createFramework(tenantAId, 'actor-a', {
      authorityId: authority.id,
      name: 'Basic Education',
      code: `BE-${label}`,
    });
    const version = await curriculum.createVersion(tenantAId, 'actor-a', {
      frameworkId: framework.id,
      versionLabel: label,
      effectiveFrom,
    });
    await curriculum.addSubject(tenantAId, 'actor-a', version.id, {
      code: 'MATH',
      name: `Mathematics ${label}`,
    });
    await curriculum.activateVersion(tenantAId, 'actor-a', version.id);
    return version.id;
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();

    owner = makeSuperuserClient();
    tenantDb = app.get(TenantDbService);
    curriculum = app.get(CurriculumService);
    adoptions = app.get(CurriculumAdoptionService);
    overlays = app.get(CurriculumOverlayService);
    mappings = app.get(CurriculumMappingService);

    const ta = await owner.tenant.create({
      data: { name: 'Curr A', slug: A, status: 'active' },
    });
    const tb = await owner.tenant.create({
      data: { name: 'Curr B', slug: B, status: 'active' },
    });
    tenantAId = ta.id;
    tenantBId = tb.id;

    // National reference content (tenant_id NULL = shared, immutable to tenants).
    const natAuthority = await owner.curriculumAuthority.create({
      data: {
        tenantId: null,
        name: 'NERDC',
        code: `NERDC-${Date.now()}`,
        kind: 'national',
        country: 'NG',
      },
    });
    const natFramework = await owner.curriculumFramework.create({
      data: {
        tenantId: null,
        authorityId: natAuthority.id,
        name: 'Basic Education',
        code: `BEC-${Date.now()}`,
      },
    });
    const natVersion = await owner.curriculumVersion.create({
      data: {
        tenantId: null,
        frameworkId: natFramework.id,
        versionLabel: 'NERDC 2020',
        effectiveFrom: new Date('2020-09-01'),
        approvalState: 'active',
        isNationalImmutable: true,
      },
    });
    await owner.curriculumSubject.create({
      data: {
        tenantId: null,
        versionId: natVersion.id,
        code: 'ENG',
        name: 'English',
      },
    });
    nationalVersionId = natVersion.id;
  });

  afterAll(async () => {
    if (owner) {
      await owner.$executeRaw`DELETE FROM "curriculum"."curriculum_authorities" WHERE "tenant_id" IS NULL AND "code" LIKE 'NERDC-%'`;
      await owner.tenant.deleteMany({ where: { slug: { in: [A, B] } } });
      await owner.$disconnect();
    }
    if (app) await app.close();
  });

  beforeEach(async () => {
    const ids = [tenantAId, tenantBId];
    // Deleting a tenant's authorities cascades its framework/version/subject tree.
    await owner.$executeRaw`DELETE FROM "curriculum"."curriculum_adoptions" WHERE "tenant_id" = ANY(${ids})`;
    await owner.$executeRaw`DELETE FROM "curriculum"."tenant_curriculum_overlays" WHERE "tenant_id" = ANY(${ids})`;
    await owner.$executeRaw`DELETE FROM "curriculum"."curriculum_mappings" WHERE "tenant_id" = ANY(${ids})`;
    await owner.$executeRaw`DELETE FROM "curriculum"."curriculum_authorities" WHERE "tenant_id" = ANY(${ids})`;
  });

  it('runs two cohorts on different versions in one campus; a prior version is untouched when a new one activates', async () => {
    const v2020 = await scopedA(() => makeActiveVersion('2020', '2020-09-01'));
    const v2025 = await scopedA(() => makeActiveVersion('2025', '2025-09-01'));

    await scopedA(() =>
      adoptions.adopt(tenantAId, 'actor-a', {
        versionId: v2020,
        entryCohort: 'Primary 4',
        campusId: 'campus-1',
        effectiveFrom: '2020-09-01',
      }),
    );
    await scopedA(() =>
      adoptions.adopt(tenantAId, 'actor-a', {
        versionId: v2025,
        entryCohort: 'Primary 1',
        campusId: 'campus-1',
        effectiveFrom: '2025-09-01',
      }),
    );

    // Same campus, same date, different cohorts → different governing versions.
    const p1 = await scopedA(() =>
      adoptions.resolveForCohort(
        tenantAId,
        'Primary 1',
        'campus-1',
        '2025-10-01',
      ),
    );
    const p4 = await scopedA(() =>
      adoptions.resolveForCohort(
        tenantAId,
        'Primary 4',
        'campus-1',
        '2025-10-01',
      ),
    );
    expect(p1?.version?.id).toBe(v2025);
    expect(p4?.version?.id).toBe(v2020);

    // The 2020 version's content is unchanged by 2025 activating.
    const tree2020 = await scopedA(() => curriculum.getVersionTree(v2020));
    expect(tree2020.subjects).toHaveLength(1);
    expect(tree2020.subjects[0].name).toBe('Mathematics 2020');
  });

  it('refuses to activate a version with an unreviewed AI node, then allows it once reviewed', async () => {
    const { versionId, nodeId } = await scopedA(async () => {
      const authority = await curriculum.createAuthority(tenantAId, 'actor-a', {
        name: 'AI Board',
        code: `AIB-${Date.now()}`,
      });
      const framework = await curriculum.createFramework(tenantAId, 'actor-a', {
        authorityId: authority.id,
        name: 'AI Framework',
        code: `AIF-${Date.now()}`,
      });
      const version = await curriculum.createVersion(tenantAId, 'actor-a', {
        frameworkId: framework.id,
        versionLabel: 'ai-v1',
        effectiveFrom: '2026-09-01',
      });
      const subject = await curriculum.addSubject(
        tenantAId,
        'actor-a',
        version.id,
        {
          code: 'SCI',
          name: 'Science',
        },
      );
      const node = await curriculum.addNode(tenantAId, 'actor-a', subject.id, {
        title: 'AI-suggested topic',
        origin: 'ai',
      });
      return { versionId: version.id, nodeId: node.id };
    });

    await expect(
      scopedA(() =>
        curriculum.activateVersion(tenantAId, 'actor-a', versionId),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    await scopedA(() => curriculum.reviewNode(tenantAId, 'actor-a', nodeId));
    const activated = await scopedA(() =>
      curriculum.activateVersion(tenantAId, 'actor-a', versionId),
    );
    expect(activated.approvalState).toBe('active');
  });

  it('national content is readable by any tenant but immutable to it', async () => {
    // Tenant A can READ the shared national version.
    const tree = await scopedA(() =>
      curriculum.getVersionTree(nationalVersionId),
    );
    expect(tree.version.id).toBe(nationalVersionId);
    expect(tree.subjects.length).toBeGreaterThanOrEqual(1);

    // Tenant B can read it too.
    const treeB = await scopedB(() =>
      curriculum.getVersionTree(nationalVersionId),
    );
    expect(treeB.version.id).toBe(nationalVersionId);

    // But a tenant cannot author on it (must use an overlay).
    await expect(
      scopedA(() =>
        curriculum.addSubject(tenantAId, 'actor-a', nationalVersionId, {
          code: 'HACK',
          name: 'Injected subject',
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    // An overlay is the sanctioned customization path.
    const overlay = await scopedA(() =>
      overlays.create(tenantAId, 'actor-a', {
        baseVersionId: nationalVersionId,
        changeType: 'add_subject',
        payload: { code: 'LOCAL', name: 'Local Studies' },
      }),
    );
    await scopedA(() => overlays.approve(tenantAId, 'actor-a', overlay.id));
    const list = await scopedA(() =>
      overlays.list(tenantAId, nationalVersionId),
    );
    expect(list).toHaveLength(1);
    expect(list[0].status).toBe('active');
  });

  it('isolates a tenant version from another tenant (RLS)', async () => {
    const vA = await scopedA(() => makeActiveVersion('iso', '2024-09-01'));

    const fromA = await scopedA(() =>
      tenantDb.client.curriculumVersion.findFirst({ where: { id: vA } }),
    );
    const fromB = await scopedB(() =>
      tenantDb.client.curriculumVersion.findFirst({ where: { id: vA } }),
    );
    expect(fromA?.id).toBe(vA);
    expect(fromB).toBeNull();
  });

  it('resolves a dirty legacy subject name to its canonical mapping', async () => {
    await scopedA(() =>
      mappings.upsert(tenantAId, 'actor-a', {
        fromName: 'Cultural And Creative Arts',
        toCanonicalName: 'Cultural & Creative Arts',
      }),
    );
    // Different punctuation/casing normalizes to the same key.
    const resolved = await scopedA(() =>
      mappings.resolve(tenantAId, 'cultural  &  creative arts'),
    );
    expect(resolved?.toCanonicalName).toBe('Cultural & Creative Arts');
  });
});
