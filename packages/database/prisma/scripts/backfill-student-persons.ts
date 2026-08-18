import { prisma } from '../../src/singleton.js';

/**
 * Backfill: give every Student an F1 `Person` (`students.person_id`).
 *
 * `Student.personId` is nullable and back-filled — the person schema (F1 /
 * ADR-01) arrived after Student, so only records created through a path that
 * knows about it carry the link. Admissions conversion does set it
 * (`AdmissionsService.convertToStudent`); students created directly — by the
 * dev seed, or by any pre-F1 path — do not.
 *
 * That gap is visible in the product: the Students directory drills into the
 * shared person detail drawer, which is keyed on the person. A student with no
 * person simply has no drill-in, so an otherwise ordinary row is inert.
 *
 * This creates one Person per person-less Student and links it, taking names
 * from the student's own profile. It NEVER invents a name: `Person.firstName`
 * and `.lastName` are both required, and a person is an identity record, so a
 * student missing either half is skipped and reported for a human rather than
 * seeded with a student number in a name column.
 *
 * Idempotent: students that already have a person are skipped, so re-running
 * only picks up what is still unlinked. Tenant-scoped in the same pass, so a
 * multi-tenant database is walked safely.
 *
 * Usage (never against production without a current backup):
 *   DATABASE_URL="$URL" pnpm --filter @workspace/database db:backfill:student-persons
 *   …add --dry-run to report what WOULD change without writing.
 */

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  console.log(
    `\nBackfilling Student → Person links${DRY_RUN ? ' (DRY RUN)' : ''}…\n`,
  );

  const students = await prisma.student.findMany({
    where: { personId: null },
    select: {
      id: true,
      tenantId: true,
      studentNumber: true,
      userTenant: {
        select: {
          id: true,
          user: { select: { firstName: true, lastName: true } },
        },
      },
    },
    orderBy: [{ tenantId: 'asc' }, { studentNumber: 'asc' }],
  });

  const already = await prisma.student.count({
    where: { NOT: { personId: null } },
  });

  if (students.length === 0) {
    console.log(`Nothing to do — all ${already} student(s) already linked.\n`);
    return;
  }

  let linked = 0;
  const skipped: string[] = [];

  for (const student of students) {
    const first = student.userTenant?.user?.firstName?.trim() || null;
    const last = student.userTenant?.user?.lastName?.trim() || null;

    // `Person.firstName` and `.lastName` are both required, and a person record
    // is an identity record — so this never invents one. A student missing
    // either half is skipped and reported for a human, rather than seeding the
    // person schema with a student number in a name column or an empty string
    // that every downstream display would then have to special-case.
    if (!first || !last) {
      skipped.push(student.studentNumber);
      continue;
    }

    if (DRY_RUN) {
      linked += 1;
      continue;
    }

    // One transaction per student: the Person and the link land together, so a
    // failure can never leave an orphan Person behind.
    await prisma.$transaction(async (tx) => {
      const person = await tx.person.create({
        data: {
          tenantId: student.tenantId,
          firstName: first,
          lastName: last,
          status: 'active',
        },
      });
      await tx.student.update({
        where: { id: student.id },
        data: { personId: person.id },
      });
    });
    linked += 1;
  }

  console.log(
    `students: ${linked} linked · ${already} already linked${
      DRY_RUN ? ' (nothing written)' : ''
    }`,
  );
  if (skipped.length > 0) {
    console.log(
      `\n${skipped.length} student(s) skipped — no first/last name on their` +
        ' profile, and a person record is not something to invent. Give them a' +
        ' name (People → the student) and re-run:',
    );
    for (const n of skipped) console.log(`  ${n}`);
  }
  if (DRY_RUN) console.log('\nDRY RUN — nothing was written.');
  console.log('');
}

main()
  .catch((error) => {
    console.error('\nBackfill failed:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
