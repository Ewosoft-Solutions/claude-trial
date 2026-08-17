import { prisma } from '../../src/singleton.js';

/**
 * Retirement readiness gate for the legacy academic spine (Class, Course,
 * Enrollment, ClassTeacher).
 *
 * Dropping those tables is the one step in the alignment programme that cannot
 * be undone, and the danger is not the drop itself — it is the CASCADES. Both
 * `assessments.class_id` and `lessons.class_id` are ON DELETE CASCADE, so a
 * class removed while rows still point at it takes real marks and real teaching
 * content with it, silently.
 *
 * This answers one question: would retiring the legacy spine right now destroy
 * anything? It writes nothing. Run it before any retirement migration, and in
 * every environment separately — a staging database being clean says nothing
 * about production.
 *
 * Exit code 0 = safe to proceed, 1 = blockers remain (so it can gate CI or a
 * deploy step).
 *
 * Usage:
 *   DATABASE_URL="$URL" pnpm --filter @workspace/database db:check:legacy-retirement
 */

interface Blocker {
  what: string;
  count: number;
  consequence: string;
  fix: string;
}

async function main() {
  const host = (() => {
    try {
      return new URL(process.env.DATABASE_URL ?? '').host || '(unknown)';
    } catch {
      return '(unknown)';
    }
  })();
  console.log(`\nLegacy retirement readiness — ${host}\n`);

  const [
    classes,
    courses,
    enrolments,
    classTeachers,
    assessmentsUnmapped,
    lessonsUnmapped,
    gradesUnmapped,
    submissionsUnmapped,
  ] = await Promise.all([
    prisma.class.count(),
    prisma.course.count(),
    prisma.enrollment.count(),
    prisma.classTeacher.count(),
    prisma.assessment.count({ where: { subjectOfferingId: null } }),
    prisma.lesson.count({ where: { curriculumSubjectId: null } }),
    prisma.grade.count({ where: { studentId: null } }),
    prisma.assessmentSubmission.count({ where: { studentId: null } }),
  ]);

  console.log(
    'Legacy rows still present (informational — these are what gets dropped):',
  );
  console.log(
    `  classes ${classes} · courses ${courses} · enrolments ${enrolments} · classTeachers ${classTeachers}\n`,
  );

  const blockers: Blocker[] = [];

  if (assessmentsUnmapped > 0) {
    blockers.push({
      what: 'assessments with no subject offering',
      count: assessmentsUnmapped,
      consequence:
        'assessments.class_id cascades — dropping Class DELETES these assessments and their grades',
      fix: 'db:backfill:assessment-offerings, then attach whatever it reports by hand',
    });
  }
  if (lessonsUnmapped > 0) {
    blockers.push({
      what: 'lessons not yet in the library',
      count: lessonsUnmapped,
      consequence:
        'lessons.class_id cascades — dropping Class DELETES these lessons, their materials and their embeddings',
      fix: 'db:backfill:lesson-library, then attach whatever it reports by hand',
    });
  }
  if (gradesUnmapped > 0) {
    blockers.push({
      what: 'grades with no student',
      count: gradesUnmapped,
      consequence:
        'dropping Enrollment loses the link between a mark and a child',
      fix: 'db:backfill:assessment-offerings (deterministic — it cannot fail)',
    });
  }
  if (submissionsUnmapped > 0) {
    blockers.push({
      what: 'assessment submissions with no student',
      count: submissionsUnmapped,
      consequence:
        'dropping Enrollment loses the link between a submission and a child',
      fix: 'db:backfill:assessment-offerings (deterministic — it cannot fail)',
    });
  }

  if (blockers.length === 0) {
    console.log(
      '✔ No data blockers — every row that pointed at the legacy spine has been re-keyed.',
    );
    console.log(
      '  Code readers are NOT checked here; confirm those separately before dropping.\n',
    );
    return;
  }

  console.log(
    `✖ ${blockers.length} blocker(s) — retiring the legacy spine now would DESTROY data:\n`,
  );
  for (const b of blockers) {
    console.log(`  ${b.count} ${b.what}`);
    console.log(`      risk: ${b.consequence}`);
    console.log(`      fix:  ${b.fix}\n`);
  }
  process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error('\nReadiness check failed:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
