/**
 * WB2-1 · ADR-02 structured academic model — behavioural proof on the
 * app_runtime (RLS-enforcing) client.
 *
 * Acceptance (workbench-2 scenario 1 + WB2-1 card):
 *   - "SS1 SCIENCE" and "SS1 ARTS" at one campus model as TWO DISTINCT
 *     ClassSection rows sharing a YearLevel and differing only by Stream — no
 *     code path parses stage/year/stream out of a label; displayLabel is COMPOSED
 *     from the dimensions and stored.
 *   - an unstreamed section composes without a stream ("JSS1 Gold").
 *   - a SubjectOffering links an F6 CurriculumSubject to a section; a duplicate
 *     (same section + subject + term) is rejected.
 *   - campus scope is ENFORCED: a Campus-1-scoped actor cannot build a section on
 *     Campus-2, but can on Campus-1 (WB1-6 AccessScopeService).
 *   - campus scope also clamps the READ path: a Campus-1-scoped actor's
 *     section/offering LIST returns only Campus-1 rows (scope overrides filter),
 *     while an unscoped/global actor sees every campus.
 *   - RLS hides another tenant's structure; the HTTP guard stack rejects anon.
 *
 * Requires APP_RUNTIME_DATABASE_URL (the restricted role). Skips otherwise —
 * without it RLS is bypassed and the isolation assertions are meaningless.
 */
import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  INestApplication,
} from '@nestjs/common';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { TenantDbService } from '../src/common';
import {
  AcademicStructureModelService,
  composeSectionLabel,
} from '../src/academic-structure/services/academic-structure-model.service';
import { makeSuperuserClient } from './helpers/superuser-client';

const HAS_APP_RUNTIME = !!process.env.APP_RUNTIME_DATABASE_URL;
const d = HAS_APP_RUNTIME ? describe : describe.skip;

d(
  'Academic structure model — dimensions, no parsing, campus scope (WB2-1)',
  () => {
    let app: INestApplication;
    let owner: ReturnType<typeof makeSuperuserClient>;
    let tenantDb: TenantDbService;
    let structure: AcademicStructureModelService;

    const stamp = Date.now();
    const A = `wb21-a-${stamp}`;
    const B = `wb21-b-${stamp}`;
    const actorEmail = `wb21-actor-${stamp}@a.test`;

    let tenantAId: string;
    let tenantBId: string;
    let actorId: string;
    let campus1Id: string;
    let campus2Id: string;
    let academicYearId: string;
    let subjectId: string;

    let stageId: string;
    let ss1Id: string;
    let jss1Id: string;
    let scienceId: string;
    let artsId: string;
    let scienceSectionId: string;

    const inA = <T>(fn: () => Promise<T>) =>
      tenantDb.runScoped(tenantAId, actorId, fn);
    const inB = <T>(fn: () => Promise<T>) =>
      tenantDb.runScoped(tenantBId, actorId, fn);

    const unscoped = () => ({ userId: actorId, grantScope: null });

    beforeAll(async () => {
      const moduleRef: TestingModule = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();
      app = moduleRef.createNestApplication();
      await app.init();

      owner = makeSuperuserClient();
      tenantDb = app.get(TenantDbService);
      structure = app.get(AcademicStructureModelService);

      const [ta, tb] = await Promise.all([
        owner.tenant.create({
          data: { name: 'WB21 A', slug: A, status: 'active' },
        }),
        owner.tenant.create({
          data: { name: 'WB21 B', slug: B, status: 'active' },
        }),
      ]);
      tenantAId = ta.id;
      tenantBId = tb.id;

      const actorUser = await owner.user.create({
        data: { email: actorEmail, isActive: true },
      });
      actorId = actorUser.id;

      const [c1, c2] = await Promise.all([
        owner.campus.create({
          data: {
            tenantId: tenantAId,
            name: 'Main',
            code: 'MAIN',
            isPrimary: true,
          },
        }),
        owner.campus.create({
          data: { tenantId: tenantAId, name: 'Annex', code: 'ANNEX' },
        }),
      ]);
      campus1Id = c1.id;
      campus2Id = c2.id;

      const ay = await owner.academicYear.create({
        data: {
          tenantId: tenantAId,
          name: `${stamp}-AY`,
          startDate: new Date('2026-09-01'),
          endDate: new Date('2027-07-31'),
          status: 'active',
        },
      });
      academicYearId = ay.id;

      // Minimal F6 curriculum chain (tenant-owned so it is visible under tenant A
      // RLS) to back a SubjectOffering.
      const authority = await owner.curriculumAuthority.create({
        data: {
          tenantId: tenantAId,
          name: 'Tenant Curriculum',
          code: `AUTH-${stamp}`,
          kind: 'tenant',
        },
      });
      const framework = await owner.curriculumFramework.create({
        data: {
          tenantId: tenantAId,
          authorityId: authority.id,
          name: 'Local',
          code: `FW-${stamp}`,
        },
      });
      const version = await owner.curriculumVersion.create({
        data: {
          tenantId: tenantAId,
          frameworkId: framework.id,
          versionLabel: `V-${stamp}`,
          effectiveFrom: new Date('2026-09-01'),
        },
      });
      const subject = await owner.curriculumSubject.create({
        data: {
          tenantId: tenantAId,
          versionId: version.id,
          code: `MATH-${stamp}`,
          name: 'Mathematics',
        },
      });
      subjectId = subject.id;
    });

    afterAll(async () => {
      if (owner) {
        const inTenants = { tenantId: { in: [tenantAId, tenantBId] } };
        await owner.subjectOffering.deleteMany({ where: inTenants });
        await owner.classSection.deleteMany({ where: inTenants });
        await owner.yearLevel.deleteMany({ where: inTenants });
        await owner.stream.deleteMany({ where: inTenants });
        await owner.stage.deleteMany({ where: inTenants });
        await owner.curriculumSubject.deleteMany({ where: inTenants });
        await owner.curriculumVersion.deleteMany({ where: inTenants });
        await owner.curriculumFramework.deleteMany({ where: inTenants });
        await owner.curriculumAuthority.deleteMany({ where: inTenants });
        await owner.academicYear.deleteMany({ where: inTenants });
        await owner.campus.deleteMany({ where: { tenantId: tenantAId } });
        await owner.tenant.deleteMany({ where: { slug: { in: [A, B] } } });
        await owner.user.deleteMany({ where: { email: actorEmail } });
        await owner.$disconnect();
      }
      if (app) await app.close();
    });

    it('composes a display label from dimensions (never parses one)', () => {
      expect(composeSectionLabel('SS1', 'Science', 'A')).toBe('SS1 Science A');
      expect(composeSectionLabel('JSS1', null, 'Gold')).toBe('JSS1 Gold');
      expect(composeSectionLabel('SS1', undefined, 'B')).toBe('SS1 B');
    });

    it('builds the dimensional structure (stage → year → streams)', async () => {
      const stage = await inA(() =>
        structure.createStage(tenantAId, actorId, {
          name: 'Senior Secondary',
          code: 'SSS',
        }),
      );
      stageId = stage.id;

      const [ss1, jss1] = await inA(async () => [
        await structure.createYearLevel(tenantAId, actorId, {
          stageId,
          name: 'SS1',
          code: 'SS1',
        }),
        await structure.createYearLevel(tenantAId, actorId, {
          stageId,
          name: 'JSS1',
          code: 'JSS1',
        }),
      ]);
      ss1Id = ss1.id;
      jss1Id = jss1.id;

      const [science, arts] = await inA(async () => [
        await structure.createStream(tenantAId, actorId, {
          name: 'Science',
          code: 'SCI',
        }),
        await structure.createStream(tenantAId, actorId, {
          name: 'Arts',
          code: 'ART',
        }),
      ]);
      scienceId = science.id;
      artsId = arts.id;

      expect(stageId).toBeTruthy();
      expect(ss1Id).not.toBe(jss1Id);
      expect(scienceId).not.toBe(artsId);
    });

    it('models SS1 SCIENCE and SS1 ARTS as two DISTINCT rows without parsing', async () => {
      const scienceSection = await inA(() =>
        structure.createClassSection(tenantAId, unscoped(), {
          campusId: campus1Id,
          yearLevelId: ss1Id,
          streamId: scienceId,
          name: 'A',
        }),
      );
      const artsSection = await inA(() =>
        structure.createClassSection(tenantAId, unscoped(), {
          campusId: campus1Id,
          yearLevelId: ss1Id,
          streamId: artsId,
          name: 'A',
        }),
      );
      scienceSectionId = scienceSection.id;

      // Two distinct rows, same campus + year, different stream — no label parsing.
      expect(scienceSection.id).not.toBe(artsSection.id);
      expect(scienceSection.yearLevelId).toBe(artsSection.yearLevelId);
      expect(scienceSection.streamId).not.toBe(artsSection.streamId);
      expect(scienceSection.displayLabel).toBe('SS1 Science A');
      expect(artsSection.displayLabel).toBe('SS1 Arts A');
    });

    it('composes an unstreamed section label and dedupes a section', async () => {
      const gold = await inA(() =>
        structure.createClassSection(tenantAId, unscoped(), {
          campusId: campus1Id,
          yearLevelId: jss1Id,
          name: 'Gold',
        }),
      );
      expect(gold.streamId).toBeNull();
      expect(gold.displayLabel).toBe('JSS1 Gold');

      // Same (campus, year, stream=null, name) → conflict.
      await expect(
        inA(() =>
          structure.createClassSection(tenantAId, unscoped(), {
            campusId: campus1Id,
            yearLevelId: jss1Id,
            name: 'Gold',
          }),
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('offers an F6 curriculum subject to a section and rejects a duplicate', async () => {
      const offering = await inA(() =>
        structure.createSubjectOffering(tenantAId, unscoped(), {
          classSectionId: scienceSectionId,
          academicYearId,
          curriculumSubjectId: subjectId,
        }),
      );
      expect(offering.subjectLabel).toBe('Mathematics');
      expect(offering.classSectionId).toBe(scienceSectionId);

      await expect(
        inA(() =>
          structure.createSubjectOffering(tenantAId, unscoped(), {
            classSectionId: scienceSectionId,
            academicYearId,
            curriculumSubjectId: subjectId,
          }),
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('enforces campus scope: a Campus-1 actor cannot build on Campus-2, but can on Campus-1', async () => {
      const campus1Actor = {
        userId: actorId,
        grantScope: { type: 'campus', value: campus1Id, label: 'Main' },
      };

      await expect(
        inA(() =>
          structure.createClassSection(tenantAId, campus1Actor, {
            campusId: campus2Id,
            yearLevelId: ss1Id,
            streamId: scienceId,
            name: 'Scoped',
          }),
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);

      const ok = await inA(() =>
        structure.createClassSection(tenantAId, campus1Actor, {
          campusId: campus1Id,
          yearLevelId: ss1Id,
          streamId: scienceId,
          name: 'Scoped',
        }),
      );
      expect(ok.campusId).toBe(campus1Id);
    });

    it('clamps the READ path: a Campus-1 registrar lists only Campus-1 sections/offerings', async () => {
      // Seed a Campus-2 section + offering with an UNSCOPED actor, so there is
      // cross-campus data available to (not) leak on the read path.
      const campus2Section = await inA(() =>
        structure.createClassSection(tenantAId, unscoped(), {
          campusId: campus2Id,
          yearLevelId: ss1Id,
          streamId: artsId,
          name: 'Annex',
        }),
      );
      await inA(() =>
        structure.createSubjectOffering(tenantAId, unscoped(), {
          classSectionId: campus2Section.id,
          academicYearId,
          curriculumSubjectId: subjectId,
        }),
      );

      const campus1Actor = {
        userId: actorId,
        grantScope: { type: 'campus', value: campus1Id, label: 'Main' },
      };

      // Sections: the scoped actor sees only its own campus, never the Campus-2
      // row — even when it explicitly asks for Campus-2 (scope OVERRIDES filter).
      const scopedSections = await inA(() =>
        structure.listClassSections(tenantAId, campus1Actor, {}),
      );
      expect(scopedSections.length).toBeGreaterThan(0);
      expect(scopedSections.every((s) => s.campusId === campus1Id)).toBe(true);
      expect(scopedSections.some((s) => s.id === campus2Section.id)).toBe(false);

      const askingCampus2 = await inA(() =>
        structure.listClassSections(tenantAId, campus1Actor, {
          campusId: campus2Id,
        }),
      );
      expect(askingCampus2.every((s) => s.campusId === campus1Id)).toBe(true);

      // Offerings carry no campusId — the clamp reaches through the parent
      // section's campus, so the Campus-2 offering is not visible.
      const scopedOfferings = await inA(() =>
        structure.listSubjectOfferings(tenantAId, campus1Actor, {}),
      );
      expect(
        scopedOfferings.some((o) => o.classSectionId === campus2Section.id),
      ).toBe(false);

      // Even explicitly filtering by the Campus-2 section returns nothing — the
      // campus clamp AND-composes with the classSectionId filter (no leak).
      const offeringsAskingCampus2Section = await inA(() =>
        structure.listSubjectOfferings(tenantAId, campus1Actor, {
          classSectionId: campus2Section.id,
        }),
      );
      expect(offeringsAskingCampus2Section.length).toBe(0);

      // An unscoped/global actor is unaffected: it still sees BOTH campuses.
      const allSections = await inA(() =>
        structure.listClassSections(tenantAId, unscoped(), {}),
      );
      expect(allSections.some((s) => s.campusId === campus1Id)).toBe(true);
      expect(allSections.some((s) => s.campusId === campus2Id)).toBe(true);

      // Fail CLOSED: a malformed campus scope with no campus is DENIED, never
      // silently unclamped to see every campus (matches the write path).
      await expect(
        inA(() =>
          structure.listClassSections(
            tenantAId,
            { userId: actorId, grantScope: { type: 'campus' } },
            {},
          ),
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('isolates tenants via RLS: tenant B sees none of tenant A structure and cannot use its campus', async () => {
      const seenFromB = await inB(() =>
        structure.listClassSections(tenantBId, unscoped(), {}),
      );
      expect(seenFromB.length).toBe(0);

      // Tenant B cannot create a section against tenant A's campus (RLS hides it).
      await expect(
        inB(() =>
          structure.createClassSection(tenantBId, unscoped(), {
            campusId: campus1Id,
            yearLevelId: ss1Id,
            name: 'X',
          }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects unauthenticated structure calls at the HTTP boundary', async () => {
      const http = app.getHttpServer();
      await request(http).get('/academics/structure/stages').expect(401);
      await request(http)
        .post('/academics/structure/sections')
        .send({})
        .expect(401);
    });
  },
);
