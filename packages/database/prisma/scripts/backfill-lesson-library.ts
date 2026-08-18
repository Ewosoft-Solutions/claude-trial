import { prisma } from '../../src/singleton.js';

/**
 * Backfill: move legacy class-keyed lessons into the LIBRARY.
 *
 *   lessons.curriculum_subject_id ← matched from the lesson's legacy Class
 *
 * A legacy Lesson hangs off a labelled-bag `Class`, which names a `Course`,
 * which names a subject. The library anchors on an F6 `CurriculumSubject`, so
 * this matches the course's subject name against the curriculum subjects this
 * tenant can see, and requires the match to be UNIQUE.
 *
 * Anything ambiguous is left alone and reported. That matters more here than
 * usual: `lessons.class_id` is ON DELETE CASCADE, so a lesson left unmatched
 * when Class is eventually dropped loses its materials AND their embeddings —
 * but a lesson filed under the WRONG subject is worse, because it silently
 * feeds another subject's AI answers.
 *
 * Idempotent: lessons already in the library are skipped.
 *
 * Usage (never against production without a current backup):
 *   DATABASE_URL="$URL" pnpm --filter @workspace/database db:backfill:lesson-library
 *   …add --dry-run to report what WOULD change without writing.
 */

const DRY_RUN = process.argv.includes('--dry-run');

function fold(value: string | null | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .replace(/[\s_\-./]+/g, '')
    .trim();
}

async function main() {
  const host = (() => {
    try {
      return new URL(process.env.DATABASE_URL ?? '').host || '(unknown)';
    } catch {
      return '(unknown)';
    }
  })();
  console.log(
    `\nMoving legacy lessons into the library on ${host}${DRY_RUN ? ' (DRY RUN — no writes)' : ''}\n`,
  );

  const lessons = await prisma.lesson.findMany({
    where: { curriculumSubjectId: null, classId: { not: null } },
    select: { id: true, title: true, tenantId: true, classId: true },
  });

  // Curriculum subjects are nullable-tenant (shared national + own), so read
  // them once and match in memory rather than once per lesson.
  const subjects = await prisma.curriculumSubject.findMany({
    select: { id: true, name: true, canonicalName: true, tenantId: true },
  });

  let moved = 0;
  const problems: string[] = [];

  for (const lesson of lessons) {
    if (!lesson.classId) continue;
    const klass = await prisma.class.findUnique({
      where: { id: lesson.classId },
      select: { name: true, course: { select: { subject: true, name: true } } },
    });
    const subjectLabel = klass?.course?.subject || klass?.course?.name || '';
    if (!subjectLabel) {
      problems.push(`"${lesson.title}": its legacy class names no subject`);
      continue;
    }

    const visible = subjects.filter(
      (s) => s.tenantId === null || s.tenantId === lesson.tenantId,
    );
    const matches = visible.filter(
      (s) =>
        fold(s.name) === fold(subjectLabel) ||
        fold(s.canonicalName) === fold(subjectLabel),
    );

    if (matches.length === 1) {
      if (!DRY_RUN) {
        await prisma.lesson.update({
          where: { id: lesson.id },
          data: { curriculumSubjectId: matches[0]!.id },
        });
      }
      moved += 1;
      console.log(`  · "${lesson.title}" → ${matches[0]!.name}`);
    } else {
      problems.push(
        `"${lesson.title}" (subject "${subjectLabel}"): ` +
          (matches.length === 0
            ? 'no curriculum subject with that name is visible to this school'
            : `${matches.length} curriculum subjects match — pick one by hand`),
      );
    }
  }

  console.log(
    `\nlessons: ${moved} moved into the library · ${problems.length} need a human`,
  );
  if (problems.length > 0) {
    console.log(
      '\nLeft alone (a lesson filed under the wrong subject would feed the wrong AI answers):',
    );
    for (const p of problems) console.log(`  ${p}`);
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
