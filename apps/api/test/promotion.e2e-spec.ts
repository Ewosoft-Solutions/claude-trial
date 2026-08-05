/**
 * WB2-4 · Promotion workbench (year rollover) — behavioural proof on the
 * app_runtime (RLS-enforcing) client.
 *
 * Acceptance (workbench-2 scenario 4 + WB2-4 card):
 *   - preview() lists the cohort with PROPOSED next-year placements.
 *   - setException() on one student changes ONLY that student.
 *   - the commit is maker-checker-gated: the MAKER cannot approve their own
 *     request; a SECOND approver commits it.
 *   - commit creates NEXT-year enrollments and leaves the PRIOR year untouched.
 *   - RLS isolates tenants; HTTP 401 at the boundary.
 *
 * Requires APP_RUNTIME_DATABASE_URL; skips otherwise.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, INestApplication } from '@nestjs/common';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { TenantDbService } from '../src/common';
import {
  PromotionService,
  type PromotionActor,
} from '../src/academic-structure/services/promotion.service';
import { makeSuperuserClient } from './helpers/superuser-client';

const HAS_APP_RUNTIME = !!process.env.APP_RUNTIME_DATABASE_URL;
const d = HAS_APP_RUNTIME ? describe : describe.skip;

d(
  'Promotion workbench — preview/exceptions/maker-checker commit (WB2-4)',
  () => {
    let app: INestApplication;
    let owner: ReturnType<typeof makeSuperuserClient>;
    let tenantDb: TenantDbService;
    let promotion: PromotionService;

    const stamp = Date.now();
    const A = `wb24-a-${stamp}`;
    const B = `wb24-b-${stamp}`;

    let tenantAId: string;
    let tenantBId: string;
    let campusId: string;
    let fromYearId: string;
    let toYearId: string;
    let ss1YearLevelId: string; // from year level
    let ss2YearLevelId: string; // to year level
    let ss1SectionId: string; // from (SS1)
    let ss2SectionId: string; // to (SS2) — same stream + name so it is auto-proposed
    let promoteStudentId: string;
    let withholdStudentId: string;
    let makerId: string;
    let checkerId: string;

    const maker: () => PromotionActor = () => ({
      userId: makerId,
      clearanceLevel: 7,
      grantScope: null,
    });
    const checker: () => PromotionActor = () => ({
      userId: checkerId,
      clearanceLevel: 7,
      grantScope: null,
    });

    const inA = <T>(fn: () => Promise<T>) =>
      tenantDb.runScoped(tenantAId, makerId, fn);
    const inB = <T>(fn: () => Promise<T>) =>
      tenantDb.runScoped(tenantBId, makerId, fn);

    async function makeStudentEnrolledInSS1(tag: string) {
      const user = await owner.user.create({
        data: { email: `wb24-${tag}-${stamp}@s.test`, isActive: true },
      });
      const ut = await owner.userTenant.create({
        data: { userId: user.id, tenantId: tenantAId, status: 'active' },
      });
      const student = await owner.student.create({
        data: {
          tenantId: tenantAId,
          userTenantId: ut.id,
          studentNumber: `STU-${tag}-${stamp}`,
          enrollmentStatus: 'active',
        },
      });
      await owner.sectionEnrollment.create({
        data: {
          tenantId: tenantAId,
          studentId: student.id,
          classSectionId: ss1SectionId,
          academicYearId: fromYearId,
          status: 'active',
        },
      });
      return student.id;
    }

    beforeAll(async () => {
      const moduleRef: TestingModule = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();
      app = moduleRef.createNestApplication();
      await app.init();

      owner = makeSuperuserClient();
      tenantDb = app.get(TenantDbService);
      promotion = app.get(PromotionService);

      const [ta, tb, mk, ck] = await Promise.all([
        owner.tenant.create({
          data: {
            name: 'WB24 A',
            slug: A,
            status: 'active',
            schoolType: 'secondary',
          },
        }),
        owner.tenant.create({
          data: {
            name: 'WB24 B',
            slug: B,
            status: 'active',
            schoolType: 'secondary',
          },
        }),
        owner.user.create({
          data: { email: `wb24-maker-${stamp}@a.test`, isActive: true },
        }),
        owner.user.create({
          data: { email: `wb24-checker-${stamp}@a.test`, isActive: true },
        }),
      ]);
      tenantAId = ta.id;
      tenantBId = tb.id;
      makerId = mk.id;
      checkerId = ck.id;

      const campus = await owner.campus.create({
        data: {
          tenantId: tenantAId,
          name: 'Main',
          code: 'MAIN',
          isPrimary: true,
        },
      });
      campusId = campus.id;

      const stage = await owner.stage.create({
        data: { tenantId: tenantAId, name: 'Senior Secondary', code: 'SSS' },
      });
      const [ss1, ss2] = await Promise.all([
        owner.yearLevel.create({
          data: {
            tenantId: tenantAId,
            stageId: stage.id,
            name: 'SS1',
            code: 'SS1',
          },
        }),
        owner.yearLevel.create({
          data: {
            tenantId: tenantAId,
            stageId: stage.id,
            name: 'SS2',
            code: 'SS2',
          },
        }),
      ]);
      ss1YearLevelId = ss1.id;
      ss2YearLevelId = ss2.id;
      const [fromAy, toAy] = await Promise.all([
        owner.academicYear.create({
          data: {
            tenantId: tenantAId,
            name: `${stamp}-AY1`,
            startDate: new Date('2026-09-01'),
            endDate: new Date('2027-07-31'),
            status: 'active',
          },
        }),
        owner.academicYear.create({
          data: {
            tenantId: tenantAId,
            name: `${stamp}-AY2`,
            startDate: new Date('2027-09-01'),
            endDate: new Date('2028-07-31'),
            status: 'planned',
          },
        }),
      ]);
      fromYearId = fromAy.id;
      toYearId = toAy.id;

      // Matching name ("A") in both year levels so preview auto-proposes SS2 "A".
      const [s1, s2] = await Promise.all([
        owner.classSection.create({
          data: {
            tenantId: tenantAId,
            campusId,
            yearLevelId: ss1.id,
            name: 'A',
            displayLabel: 'SS1 A',
          },
        }),
        owner.classSection.create({
          data: {
            tenantId: tenantAId,
            campusId,
            yearLevelId: ss2.id,
            name: 'A',
            displayLabel: 'SS2 A',
          },
        }),
      ]);
      ss1SectionId = s1.id;
      ss2SectionId = s2.id;

      [promoteStudentId, withholdStudentId] = await Promise.all([
        makeStudentEnrolledInSS1('promote'),
        makeStudentEnrolledInSS1('withhold'),
      ]);
    });

    afterAll(async () => {
      if (owner) {
        const inTenants = { tenantId: { in: [tenantAId, tenantBId] } };
        await owner.promotionRunItem.deleteMany({ where: inTenants });
        await owner.promotionRun.deleteMany({ where: inTenants });
        await owner.studentPlacementHistory.deleteMany({ where: inTenants });
        await owner.sectionEnrollment.deleteMany({ where: inTenants });
        await owner.makerCheckerRequest.deleteMany({ where: inTenants });
        await owner.classSection.deleteMany({ where: inTenants });
        await owner.yearLevel.deleteMany({ where: inTenants });
        await owner.stage.deleteMany({ where: inTenants });
        await owner.academicYear.deleteMany({ where: inTenants });
        await owner.student.deleteMany({ where: inTenants });
        await owner.campus.deleteMany({ where: inTenants });
        await owner.userTenant.deleteMany({ where: inTenants });
        await owner.tenant.deleteMany({ where: { slug: { in: [A, B] } } });
        await owner.user.deleteMany({
          where: { email: { contains: `-${stamp}@` } },
        });
        await owner.$disconnect();
      }
      if (app) await app.close();
    });

    let runId: string;
    let withholdItemId: string;

    it('previews the cohort with proposed next-year placements', async () => {
      const run = await inA(() =>
        promotion.createRun(tenantAId, maker(), {
          name: 'SS1 → SS2',
          fromAcademicYearId: fromYearId,
          toAcademicYearId: toYearId,
          fromYearLevelId: ss1YearLevelId,
          toYearLevelId: ss2YearLevelId,
          campusId,
        }),
      );
      runId = run.id;

      const { run: previewed, items } = await inA(() =>
        promotion.preview(tenantAId, maker(), runId),
      );
      expect(previewed.status).toBe('previewed');
      expect(items).toHaveLength(2);
      // Every item proposes the matching SS2 "A" section.
      for (const item of items) {
        expect(item.proposedClassSectionId).toBe(ss2SectionId);
        expect(item.decision).toBe('promote');
      }
      withholdItemId = items.find((i) => i.studentId === withholdStudentId)!.id;
    });

    it('an exception on one student changes only that student', async () => {
      await inA(() =>
        promotion.setException(tenantAId, maker(), runId, withholdItemId, {
          decision: 'withhold',
          reason: 'Repeating the year',
        }),
      );
      const { items } = await inA(() => promotion.getRun(tenantAId, runId));
      const withheld = items.find((i) => i.studentId === withholdStudentId);
      const promoted = items.find((i) => i.studentId === promoteStudentId);
      expect(withheld?.decision).toBe('withhold');
      // The OTHER student is untouched.
      expect(promoted?.decision).toBe('promote');
      expect(promoted?.proposedClassSectionId).toBe(ss2SectionId);
    });

    it('maker-checker: the maker cannot approve their own commit', async () => {
      await inA(() => promotion.requestCommit(tenantAId, maker(), runId));
      const { run } = await inA(() => promotion.getRun(tenantAId, runId));
      expect(run.status).toBe('pending_approval');
      expect(run.approvalRequestId).toBeTruthy();

      // The maker approving their own request is denied (separation of duties).
      await expect(
        inA(() => promotion.approveAndCommit(tenantAId, maker(), runId)),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('a second approver commits: next-year rows created, prior year untouched', async () => {
      const result = await inA(() =>
        promotion.approveAndCommit(tenantAId, checker(), runId),
      );
      expect(result.status).toBe('committed');
      expect(result.committed).toBe(1); // promote student
      expect(result.withheld).toBe(1); // withhold student

      // The promoted student now has a NEXT-year enrollment in SS2 "A".
      const nextYear = await owner.sectionEnrollment.findMany({
        where: {
          tenantId: tenantAId,
          studentId: promoteStudentId,
          academicYearId: toYearId,
        },
      });
      expect(nextYear).toHaveLength(1);
      expect(nextYear[0]!.classSectionId).toBe(ss2SectionId);

      // The withheld student did NOT get a next-year enrollment.
      const withheldNext = await owner.sectionEnrollment.findMany({
        where: {
          tenantId: tenantAId,
          studentId: withholdStudentId,
          academicYearId: toYearId,
        },
      });
      expect(withheldNext).toHaveLength(0);

      // The PRIOR year (SS1/AY1) enrollments are untouched — both students still
      // have their active SS1 rows.
      const priorYear = await owner.sectionEnrollment.findMany({
        where: {
          tenantId: tenantAId,
          academicYearId: fromYearId,
          classSectionId: ss1SectionId,
        },
      });
      expect(priorYear).toHaveLength(2);
      for (const e of priorYear) expect(e.status).toBe('active');
    });

    it('isolates tenants via RLS and rejects anon at the HTTP boundary', async () => {
      // Tenant B cannot see tenant A's run (RLS hides it).
      await expect(
        inB(() => promotion.getRun(tenantBId, runId)),
      ).rejects.toBeTruthy();

      const http = app.getHttpServer();
      await request(http).get('/academics/promotion/runs').expect(401);
      await request(http)
        .post('/academics/promotion/runs')
        .send({})
        .expect(401);
    });
  },
);
