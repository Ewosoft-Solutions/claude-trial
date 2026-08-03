/**
 * Unified People directory (WB1-1) — behavioural proof.
 *
 * Boots the real AppModule and exercises PeopleDirectoryService on the
 * app_runtime (RLS-enforcing) client. Proves the WB1-1 governance + acceptance:
 *   - the projection MASKS contact unless the caller holds the contact scope,
 *     and returns it raw when they do (person tab + prospect tab)
 *   - RLS isolates the projection: tenant B never sees tenant A's people
 *   - **one identity, many profiles**: a person who is both staff AND a guardian
 *     is a single row that lists both profiles (on any tab)
 *   - each tab projects the right domain: student/guardian/staff/user over
 *     `Person`, prospect over `AdmissionApplication`
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
import { PeopleDirectoryService } from '../src/directory/services/people-directory.service';
import { makeSuperuserClient } from './helpers/superuser-client';

const HAS_APP_RUNTIME = !!process.env.APP_RUNTIME_DATABASE_URL;
const d = HAS_APP_RUNTIME ? describe : describe.skip;

interface CountRow {
  n: number;
}

d('Unified People directory (WB1-1)', () => {
  let app: INestApplication;
  let owner: ReturnType<typeof makeSuperuserClient>;
  let tenantDb: TenantDbService;
  let people: PeopleDirectoryService;

  const stamp = Date.now();
  const A = `ppl-a-${stamp}`;
  const B = `ppl-b-${stamp}`;
  const combinedEmail = `ppl-combined-${stamp}@a.test`;
  const prospectEmail = `ppl-prospect-${stamp}@a.test`;
  const studentUserEmail = `ppl-stu-${stamp}@a.test`;

  let tenantAId: string;
  let tenantBId: string;
  let combinedId: string;
  let studentPersonId: string;
  let admissionId: string;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();

    owner = makeSuperuserClient();
    tenantDb = app.get(TenantDbService);
    people = app.get(PeopleDirectoryService);

    const ta = await owner.tenant.create({
      data: { name: 'People A', slug: A, status: 'active' },
    });
    const tb = await owner.tenant.create({
      data: { name: 'People B', slug: B, status: 'active' },
    });
    tenantAId = ta.id;
    tenantBId = tb.id;

    // A single identity that is BOTH staff AND a guardian (the acceptance).
    const combined = await owner.person.create({
      data: {
        tenantId: tenantAId,
        firstName: 'Grace',
        lastName: 'Adeyemi',
        status: 'active',
      },
    });
    combinedId = combined.id;
    await owner.contactPoint.create({
      data: {
        tenantId: tenantAId,
        personId: combined.id,
        kind: 'email',
        value: combinedEmail,
        valueNormalized: combinedEmail.toLowerCase(),
        isPrimary: true,
      },
    });
    await owner.staffProfile.create({
      data: {
        tenantId: tenantAId,
        personId: combined.id,
        employeeNumber: `EMP-${stamp}`,
        jobTitle: 'Bursar',
        department: 'Finance',
        employmentStatus: 'active',
      },
    });
    const ward = await owner.person.create({
      data: {
        tenantId: tenantAId,
        firstName: 'Tunde',
        lastName: 'Adeyemi',
        status: 'active',
      },
    });
    await owner.guardianRelationship.create({
      data: {
        tenantId: tenantAId,
        guardianPersonId: combined.id,
        wardPersonId: ward.id,
        relationship: 'parent',
        isPrimary: true,
      },
    });

    // A student identity (Person ← Student.personId).
    const suser = await owner.user.create({
      data: { email: studentUserEmail, firstName: 'Ada', lastName: 'Okeke' },
    });
    const sprofile = await owner.userTenant.create({
      data: { userId: suser.id, tenantId: tenantAId, status: 'active' },
    });
    const sperson = await owner.person.create({
      data: {
        tenantId: tenantAId,
        firstName: 'Ada',
        lastName: 'Okeke',
        status: 'active',
      },
    });
    studentPersonId = sperson.id;
    await owner.student.create({
      data: {
        tenantId: tenantAId,
        userTenantId: sprofile.id,
        personId: sperson.id,
        studentNumber: `STU-${stamp}`,
        gradeLevel: 'JSS1',
        enrollmentStatus: 'active',
      },
    });

    // A prospect (admission application — not yet a Person).
    const admission = await owner.admissionApplication.create({
      data: {
        tenantId: tenantAId,
        applicantName: 'Chidi Eze',
        applyingFor: 'JSS1',
        guardianName: 'Ngozi Eze',
        guardianEmail: prospectEmail,
        decision: 'pending',
      },
    });
    admissionId = admission.id;
  });

  afterAll(async () => {
    if (owner) {
      await owner.person.deleteMany({
        where: { tenantId: { in: [tenantAId, tenantBId] } },
      });
      await owner.tenant.deleteMany({ where: { slug: { in: [A, B] } } });
      await owner.user.deleteMany({ where: { email: studentUserEmail } });
      await owner.$disconnect();
    }
    if (app) await app.close();
  });

  const inA = <T>(fn: () => Promise<T>) =>
    tenantDb.runScoped(tenantAId, undefined, fn);
  const inB = <T>(fn: () => Promise<T>) =>
    tenantDb.runScoped(tenantBId, undefined, fn);

  it('masks staff contact unless the caller holds the contact scope', async () => {
    const masked = await inA(() => people.list(tenantAId, 'staff', false, {}));
    const row = masked.data.find((r) => r.id === combinedId);
    expect(row).toBeDefined();
    expect(row!.contactMasked).toBe(true);
    expect(row!.email).not.toBe(combinedEmail);

    const unmasked = await inA(() => people.list(tenantAId, 'staff', true, {}));
    expect(unmasked.data.find((r) => r.id === combinedId)!.email).toBe(
      combinedEmail,
    );
  });

  it('shows one identity with BOTH staff and guardian profiles', async () => {
    const onStaff = await inA(() => people.list(tenantAId, 'staff', true, {}));
    const staffRow = onStaff.data.find((r) => r.id === combinedId)!;
    expect(staffRow.profiles).toEqual(
      expect.arrayContaining(['staff', 'guardian']),
    );
    expect(staffRow.primary).toBe('Bursar');
    expect(staffRow.status).toBe('active');

    // The SAME identity also appears on the Guardian tab with ward summary.
    const onGuardian = await inA(() =>
      people.list(tenantAId, 'guardian', true, {}),
    );
    const guardianRow = onGuardian.data.find((r) => r.id === combinedId)!;
    expect(guardianRow).toBeDefined();
    expect(guardianRow.primary).toBe('1 ward');
    expect(guardianRow.secondary).toBe('Tunde Adeyemi');
  });

  it('projects the student tab over Person←Student', async () => {
    const res = await inA(() => people.list(tenantAId, 'student', true, {}));
    const row = res.data.find((r) => r.id === studentPersonId);
    expect(row).toBeDefined();
    expect(row!.primary).toBe(`STU-${stamp}`);
    expect(row!.secondary).toBe('JSS1');
    expect(row!.profiles).toEqual(['student']);
    // A staff-only identity never appears on the student tab.
    expect(res.data.find((r) => r.id === combinedId)).toBeUndefined();
  });

  it('projects the prospect tab over AdmissionApplication (masked guardian contact)', async () => {
    const masked = await inA(() =>
      people.list(tenantAId, 'prospect', false, {}),
    );
    const row = masked.data.find((r) => r.id === admissionId);
    expect(row).toBeDefined();
    expect(row!.name).toBe('Chidi Eze');
    expect(row!.primary).toBe('JSS1');
    expect(row!.status).toBe('pending');
    expect(row!.contactMasked).toBe(true);
    expect(row!.email).not.toBe(prospectEmail);

    const raw = await inA(() => people.list(tenantAId, 'prospect', true, {}));
    expect(raw.data.find((r) => r.id === admissionId)!.email).toBe(
      prospectEmail,
    );
  });

  it('isolates every tab by tenant (RLS): B never sees A’s people', async () => {
    for (const type of ['student', 'guardian', 'staff', 'user'] as const) {
      const fromB = await inB(() => people.list(tenantBId, type, true, {}));
      expect(fromB.data.find((r) => r.id === combinedId)).toBeUndefined();
      expect(fromB.data.find((r) => r.id === studentPersonId)).toBeUndefined();
    }
    const prospectsB = await inB(() =>
      people.list(tenantBId, 'prospect', true, {}),
    );
    expect(prospectsB.data.find((r) => r.id === admissionId)).toBeUndefined();

    // And the raw table is invisible under B's scope.
    const rawFromB = await inB(async () => {
      const rows = await tenantDb.client.$queryRaw<CountRow[]>`
        SELECT count(*)::int AS n FROM "person"."persons" WHERE "id" = ${combinedId}`;
      return rows[0].n;
    });
    expect(rawFromB).toBe(0);
  });

  it('the All tab returns every active person, and summary counts each tab', async () => {
    const all = await inA(() => people.list(tenantAId, 'all', true, {}));
    // Both the staff+guardian identity and the student appear on the roster.
    expect(all.data.find((r) => r.id === combinedId)).toBeDefined();
    expect(all.data.find((r) => r.id === studentPersonId)).toBeDefined();

    const summary = await inA(() =>
      people.summary(tenantAId, [
        'all',
        'student',
        'guardian',
        'staff',
        'user',
        'prospect',
      ]),
    );
    // Tenant A fixtures: combined (staff+guardian), its ward, the student; +1 admission.
    expect(summary.all).toBe(3);
    expect(summary.student).toBe(1);
    expect(summary.guardian).toBe(1);
    expect(summary.staff).toBe(1);
    expect(summary.prospect).toBe(1);
  });

  it('exports the selected staff rows as CSV, honouring masking + audit', async () => {
    const masked = await inA(() =>
      people.export(tenantAId, 'staff', 'owner', false, [combinedId]),
    );
    expect(masked.mimeType).toBe('text/csv');
    expect(masked.content).toContain('Bursar');
    expect(masked.content).not.toContain(combinedEmail); // masked

    const raw = await inA(() =>
      people.export(tenantAId, 'staff', 'owner', true, [combinedId]),
    );
    expect(raw.content).toContain(combinedEmail);
  });
});
