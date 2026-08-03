/**
 * Dev seed — People directory demo data (local development only).
 *
 * The base dev seeds create Persons, students, guardians and admissions but no
 * `StaffProfile`s or `ContactPoint`s, so the People workbench's Staff tab is
 * empty and the Contact column falls back to the login email. This script fills
 * those gaps so every tab (All / Students / Guardians / Staff / Users /
 * Prospects) shows data and masking is visible on real contact points.
 *
 * It also demonstrates two modelling points surfaced in review:
 *   - a person who is BOTH staff AND a guardian → one identity, two profiles;
 *   - contractors / external parties are `StaffProfile`s with
 *     `employmentType: 'contract'` (an external auditor, a peripatetic tutor) —
 *     the honest home for "vendor with limited engagement" until a dedicated
 *     external-party model is decided.
 *
 * Idempotent: re-running skips persons that already have the seeded rows.
 * Requires ENABLE_DEV_SEEDS=true and a LOCAL DATABASE_URL (see guard.ts).
 *
 *   pnpm --filter @workspace/database db:seed:people
 */
import { prisma } from '../../../src/singleton.js';
import { assertDevSeedAllowed, DEV_SEED_TAG } from './guard.js';

const SEED_NAME = 'people-directory';

/** Employment specs cycled across the chosen persons (incl. two contractors). */
const STAFF_SPECS = [
  {
    jobTitle: 'Bursar',
    department: 'Finance',
    employmentStatus: 'active',
    employmentType: 'full_time',
  },
  {
    jobTitle: 'Head of Science',
    department: 'Science',
    employmentStatus: 'active',
    employmentType: 'full_time',
  },
  {
    jobTitle: 'Class Teacher',
    department: 'Primary',
    employmentStatus: 'on_leave',
    employmentType: 'full_time',
  },
  {
    jobTitle: 'Facilities Lead',
    department: 'Operations',
    employmentStatus: 'active',
    employmentType: 'part_time',
  },
  {
    jobTitle: 'External Auditor',
    department: 'Finance',
    employmentStatus: 'active',
    employmentType: 'contract',
  },
  {
    jobTitle: 'Music Tutor',
    department: 'Arts',
    employmentStatus: 'active',
    employmentType: 'contract',
  },
] as const;

function normalize(kind: string, value: string): string {
  return kind === 'phone'
    ? value.replace(/[^\d+]/g, '')
    : value.trim().toLowerCase();
}

async function main(): Promise<void> {
  assertDevSeedAllowed(SEED_NAME);

  const persons = await prisma.person.findMany({
    where: { status: 'active' },
    select: {
      id: true,
      tenantId: true,
      firstName: true,
      lastName: true,
      _count: { select: { contactPoints: true, staffProfiles: true } },
      guardianships: { select: { id: true }, take: 1 },
    },
    orderBy: [{ tenantId: 'asc' }, { lastName: 'asc' }],
  });

  if (persons.length === 0) {
    console.log(
      `[dev-seed:${SEED_NAME}] No active persons found. Run db:seed:dev first.`,
    );
    return;
  }

  let contactsAdded = 0;
  let staffAdded = 0;
  // A STABLE target set (same persons across runs): guardians first (so we get
  // staff+guardian identities) then the rest, capped to a realistic roster.
  // Guardianship + name order don't change, so re-runs target the same people.
  const staffCap = Math.min(STAFF_SPECS.length + 2, persons.length);
  const staffTargets = [
    ...persons.filter((p) => p.guardianships.length > 0),
    ...persons.filter((p) => p.guardianships.length === 0),
  ].slice(0, staffCap);

  // Contact points: give the first ~16 contactless persons an email + phone.
  for (const person of persons.slice(0, 16)) {
    if (person._count.contactPoints > 0) continue;
    const email = `${person.firstName}.${person.lastName}@example.test`
      .replace(/\s+/g, '')
      .toLowerCase();
    const phone = `+23480${String(10000000 + contactsAdded).slice(-8)}`;
    await prisma.contactPoint.createMany({
      data: [
        {
          tenantId: person.tenantId,
          personId: person.id,
          kind: 'email',
          value: email,
          valueNormalized: normalize('email', email),
          label: 'work',
          isPrimary: true,
        },
        {
          tenantId: person.tenantId,
          personId: person.id,
          kind: 'phone',
          value: phone,
          valueNormalized: normalize('phone', phone),
          label: 'mobile',
          isPrimary: false,
        },
      ],
      skipDuplicates: true,
    });
    contactsAdded += 1;
  }

  // Staff profiles. Skip any person who already has one (so re-runs add nothing
  // and we never double-seed), and derive `employeeNumber` from the person id so
  // new rows can't collide on `@@unique([tenantId, employeeNumber])`.
  for (const [index, person] of staffTargets.entries()) {
    if (person._count.staffProfiles > 0) continue;
    const employeeNumber = `EMP-DEV-${person.id.slice(0, 8).toUpperCase()}`;
    const spec = STAFF_SPECS[index % STAFF_SPECS.length]!;
    await prisma.staffProfile.create({
      data: {
        tenantId: person.tenantId,
        personId: person.id,
        employeeNumber,
        jobTitle: spec.jobTitle,
        department: spec.department,
        employmentStatus: spec.employmentStatus,
        employmentType: spec.employmentType,
        hireDate: new Date('2024-09-01'),
      },
    });
    staffAdded += 1;
  }

  console.log(
    `[${DEV_SEED_TAG}:${SEED_NAME}] Added ${staffAdded} staff profile(s) and ${contactsAdded} contact-point set(s) across ${new Set(persons.map((p) => p.tenantId)).size} tenant(s).`,
  );
}

main()
  .catch((error) => {
    console.error(`[dev-seed:${SEED_NAME}] Failed:`, error);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
