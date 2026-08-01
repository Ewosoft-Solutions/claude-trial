/**
 * Person / identity / profile / membership (F1 / ADR-01) — behavioural proof.
 *
 * Boots the real AppModule and exercises PersonService + PersonMergeService on
 * the app_runtime (RLS-enforcing) client. Proves the ADR-01 acceptance:
 *   - one human = one Person with a staff profile AND a guardian relationship
 *     (the "staff-who-is-also-a-guardian is one identity, two profiles" case)
 *   - a guardian with NO account (userTenant) still exists and works
 *   - resolving a duplicate merges it into the survivor with history preserved
 *   - RLS isolates people: tenant A cannot see tenant B's Person
 *   - contact values are masked unless the caller may view them
 *
 * Requires APP_RUNTIME_DATABASE_URL (the restricted role). Skips otherwise —
 * without it the tenant client falls back to the privileged role and RLS is
 * bypassed, so the isolation assertions would be meaningless.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
} from '@jest/globals';
import { AppModule } from '../src/app.module';
import { TenantDbService } from '../src/common';
import { PersonService } from '../src/person/services/person.service';
import { PersonMergeService } from '../src/person/services/person-merge.service';
import { makeSuperuserClient } from './helpers/superuser-client';

const HAS_APP_RUNTIME = !!process.env.APP_RUNTIME_DATABASE_URL;
const d = HAS_APP_RUNTIME ? describe : describe.skip;

interface CountRow {
  n: number;
}

d('Person foundation (F1)', () => {
  let app: INestApplication;
  let owner: ReturnType<typeof makeSuperuserClient>;
  let tenantDb: TenantDbService;
  let people: PersonService;
  let merge: PersonMergeService;

  const A = `person-a-${Date.now()}`;
  const B = `person-b-${Date.now()}`;
  let tenantAId: string;
  let tenantBId: string;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();

    owner = makeSuperuserClient();
    tenantDb = app.get(TenantDbService);
    people = app.get(PersonService);
    merge = app.get(PersonMergeService);

    const ta = await owner.tenant.create({
      data: { name: 'Person A', slug: A, status: 'active' },
    });
    const tb = await owner.tenant.create({
      data: { name: 'Person B', slug: B, status: 'active' },
    });
    tenantAId = ta.id;
    tenantBId = tb.id;
  });

  afterAll(async () => {
    if (owner) {
      // tenant FK ON DELETE CASCADE removes persons + children for these tenants.
      await owner.tenant.deleteMany({ where: { slug: { in: [A, B] } } });
      await owner.$disconnect();
    }
    if (app) await app.close();
  });

  const inA = <T>(fn: () => Promise<T>) =>
    tenantDb.runScoped(tenantAId, undefined, fn);
  const inB = <T>(fn: () => Promise<T>) =>
    tenantDb.runScoped(tenantBId, undefined, fn);

  it('one Person carries a staff profile AND a guardian relationship (one identity, two profiles)', async () => {
    const { personId, wardId } = await inA(async () => {
      // The ward (a student's Person) — a human with no login.
      const ward = await people.create(tenantAId, undefined, {
        firstName: 'Chidi',
        lastName: 'Okafor',
      });
      // The human who is BOTH staff and a guardian.
      const person = await people.create(tenantAId, undefined, {
        firstName: 'Amaka',
        lastName: 'Okafor',
      });
      await people.addStaffProfile(tenantAId, undefined, person.id, {
        jobTitle: 'Mathematics Teacher',
        employeeNumber: `EMP-${Date.now()}`,
      });
      await people.addGuardianship(tenantAId, undefined, person.id, {
        wardPersonId: ward.id,
        relationship: 'parent',
        isPrimary: true,
      });
      return { personId: person.id, wardId: ward.id };
    });

    const detail = await inA(() => people.get(tenantAId, personId, true));
    expect(detail.staffProfiles).toHaveLength(1);
    expect(detail.guardianships).toHaveLength(1);
    expect(detail.guardianships[0].ward.id).toBe(wardId);
    // ward exists as its own Person with no account
    const ward = await inA(() => people.get(tenantAId, wardId, true));
    expect(ward.userTenantId).toBeNull();
  });

  it('masks contact values unless the caller may view them', async () => {
    const personId = await inA(async () => {
      const p = await people.create(tenantAId, undefined, {
        firstName: 'Bola',
        lastName: 'Ade',
      });
      await people.addContact(tenantAId, undefined, p.id, {
        kind: 'email',
        value: 'bola.ade@example.com',
        isPrimary: true,
      });
      return p.id;
    });

    const masked = await inA(() => people.get(tenantAId, personId, false));
    expect(masked.contactPoints[0].masked).toBe(true);
    expect(masked.contactPoints[0].value).not.toContain('bola.ade@example.com');

    const unmasked = await inA(() => people.get(tenantAId, personId, true));
    expect(unmasked.contactPoints[0].value).toBe('bola.ade@example.com');
  });

  it('resolves a duplicate by merging, preserving history on both records', async () => {
    const { survivorId, duplicateId } = await inA(async () => {
      const survivor = await people.create(tenantAId, undefined, {
        firstName: 'Ngozi',
        lastName: 'Eze',
      });
      const duplicate = await people.create(tenantAId, undefined, {
        firstName: 'Ngozi',
        lastName: 'Eze',
      });
      // Give the duplicate a staff profile + a contact to move.
      await people.addStaffProfile(tenantAId, undefined, duplicate.id, {
        jobTitle: 'Bursar',
      });
      await people.addContact(tenantAId, undefined, duplicate.id, {
        kind: 'phone',
        value: '+2348012345678',
      });
      return { survivorId: survivor.id, duplicateId: duplicate.id };
    });

    const result = await inA(() =>
      merge.merge(tenantAId, undefined, survivorId, duplicateId, 'same human'),
    );
    expect(result.moved.staffProfiles).toBe(1);

    const survivor = await inA(() => people.get(tenantAId, survivorId, true));
    expect(survivor.staffProfiles).toHaveLength(1); // re-pointed
    expect(survivor.contactPoints).toHaveLength(1);

    const duplicate = await inA(() => people.get(tenantAId, duplicateId, true));
    expect(duplicate.status).toBe('merged');
    expect(duplicate.mergedIntoId).toBe(survivorId);

    // history preserved on BOTH records
    const histSurvivor = await owner.$queryRaw<CountRow[]>`
      SELECT count(*)::int AS n FROM "person"."relationship_history"
      WHERE "person_id" = ${survivorId} AND "change_type" = 'merged_from'`;
    const histDuplicate = await owner.$queryRaw<CountRow[]>`
      SELECT count(*)::int AS n FROM "person"."relationship_history"
      WHERE "person_id" = ${duplicateId} AND "change_type" = 'merged_into'`;
    expect(histSurvivor[0].n).toBe(1);
    expect(histDuplicate[0].n).toBe(1);
  });

  it('isolates people by tenant (RLS): tenant B cannot see tenant A’s Person', async () => {
    const personId = await inA(() =>
      people
        .create(tenantAId, undefined, { firstName: 'Secret', lastName: 'Person' })
        .then((p) => p.id),
    );

    // From tenant B's scope, the row is invisible (findFirst → NotFound).
    await expect(inB(() => people.get(tenantBId, personId, true))).rejects.toThrow();

    // And a raw count under B's scope sees zero of A's persons.
    const seenFromB = await inB(async () => {
      const rows = await tenantDb.client.$queryRaw<CountRow[]>`
        SELECT count(*)::int AS n FROM "person"."persons" WHERE "id" = ${personId}`;
      return rows[0].n;
    });
    expect(seenFromB).toBe(0);
  });
});
