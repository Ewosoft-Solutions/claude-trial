import { prisma } from '../../src/singleton.js';

/**
 * Backfill: move the question bank off the legacy course.
 *
 *   questions.curriculum_subject_id  ← matched from the entry's legacy Course
 *
 * This is NOT deterministic, so it is careful. A legacy `Course` is a labelled
 * bag with a free-text `subject`; the structured world wants a
 * `CurriculumSubject`. This matches the course's subject (falling back to its
 * name) against the subject's name/canonicalName/code, and requires the match
 * to be UNIQUE.
 *
 * Anything ambiguous is REPORTED AND LEFT ALONE. A bank entry silently attached
 * to the wrong subject would surface in another subject's paper — a physics
 * question in a French exam — and nobody would know where it came from. A human
 * attaching it by hand is cheap; that is not.
 *
 * Only tenant-visible subjects are considered: curriculum_subjects carries a
 * nullable tenant_id (shared national rows + own), so candidates are the ones
 * this tenant can actually see.
 *
 * Idempotent: rows already carrying a subject are skipped.
 *
 * Usage (never against production without a current backup):
 *   DATABASE_URL="$URL" pnpm --filter @workspace/database db:backfill:question-subjects
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
    `\nRe-keying the question bank onto curriculum subjects on ${host}${
      DRY_RUN ? ' (DRY RUN — no writes)' : ''
    }\n`,
  );

  const questions = await prisma.question.findMany({
    where: { curriculumSubjectId: null, courseId: { not: null } },
    select: { id: true, tenantId: true, courseId: true, text: true },
  });

  if (questions.length === 0) {
    console.log('Nothing to do — every bank entry already names a subject.\n');
    return;
  }

  // Candidate subjects are read once per tenant, not once per question.
  const subjectsByTenant = new Map<
    string,
    Array<{
      id: string;
      name: string;
      canonicalName: string | null;
      code: string;
    }>
  >();
  async function subjectsFor(tenantId: string) {
    const cached = subjectsByTenant.get(tenantId);
    if (cached) return cached;
    // Nullable tenant_id: own rows PLUS shared national content.
    const subjects = await prisma.curriculumSubject.findMany({
      where: { OR: [{ tenantId }, { tenantId: null }] },
      select: { id: true, name: true, canonicalName: true, code: true },
    });
    subjectsByTenant.set(tenantId, subjects);
    return subjects;
  }

  const courseCache = new Map<
    string,
    { subject: string | null; name: string } | null
  >();
  async function courseFor(courseId: string) {
    if (courseCache.has(courseId)) return courseCache.get(courseId)!;
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { subject: true, name: true },
    });
    courseCache.set(courseId, course);
    return course;
  }

  let matched = 0;
  const problems: string[] = [];
  const stem = (text: string) =>
    text.length > 60 ? `${text.slice(0, 57)}…` : text;

  for (const question of questions) {
    if (!question.courseId) continue;

    const course = await courseFor(question.courseId);
    if (!course) {
      problems.push(
        `"${stem(question.text)}": its legacy course no longer exists`,
      );
      continue;
    }

    const wanted = fold(course.subject) || fold(course.name);
    if (!wanted) {
      problems.push(`"${stem(question.text)}": legacy course names no subject`);
      continue;
    }

    const candidates = (await subjectsFor(question.tenantId)).filter(
      (subject) =>
        fold(subject.name) === wanted ||
        fold(subject.canonicalName) === wanted ||
        fold(subject.code) === wanted,
    );

    if (candidates.length === 1) {
      if (!DRY_RUN) {
        await prisma.question.update({
          where: { id: question.id },
          data: { curriculumSubjectId: candidates[0]!.id },
        });
      }
      matched += 1;
    } else {
      problems.push(
        `"${stem(question.text)}" (course subject ${course.subject ?? course.name}): ` +
          (candidates.length === 0
            ? 'no curriculum subject matches that name'
            : `${candidates.length} subjects match — attach it by hand`),
      );
    }
  }

  console.log(
    `questions: ${matched} re-keyed to a subject · ${problems.length} need a human`,
  );
  if (problems.length > 0) {
    console.log(
      "\nLeft alone (a wrong subject would surface in another subject's paper):",
    );
    for (const problem of problems) console.log(`  ${problem}`);
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
