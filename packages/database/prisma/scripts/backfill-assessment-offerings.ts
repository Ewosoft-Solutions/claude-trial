import { prisma } from '../../src/singleton.js';

/**
 * Backfill: move the day-to-day gradebook off the legacy spine.
 *
 *   grades.student_id                  ← enrollment.student_id
 *   assessment_submissions.student_id  ← enrollment.student_id
 *   assessments.subject_offering_id    ← matched from the legacy Class
 *
 * The two student re-keys are DETERMINISTIC: an Enrollment already names its
 * student, so there is nothing to infer and nothing that can go wrong.
 *
 * The assessment re-key is not. A legacy `Class` is a labelled bag with a
 * `Course`; the structured world wants a `SubjectOffering` (section × curriculum
 * subject × year/term). This matches on the class's academic year plus the
 * course's subject name against the offering's `subjectLabel`, and requires the
 * match to be UNIQUE — an assessment silently attached to the wrong class's
 * offering would corrupt marks for a whole cohort, so anything ambiguous is
 * reported and left alone for a human.
 *
 * Idempotent: rows already carrying the new value are skipped.
 *
 * Usage (never against production without a current backup):
 *   DATABASE_URL="$URL" pnpm --filter @workspace/database db:backfill:assessment-offerings
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
    `\nRe-keying the gradebook onto offerings on ${host}${DRY_RUN ? ' (DRY RUN — no writes)' : ''}\n`,
  );

  // ---------------------------------------------------------------- grades
  const grades = await prisma.grade.findMany({
    where: { studentId: null, enrollmentId: { not: null } },
    select: { id: true, enrollmentId: true },
  });
  let gradesMoved = 0;
  for (const grade of grades) {
    if (!grade.enrollmentId) continue;
    const enrolment = await prisma.enrollment.findUnique({
      where: { id: grade.enrollmentId },
      select: { studentId: true },
    });
    if (!enrolment) continue;
    if (!DRY_RUN) {
      await prisma.grade.update({
        where: { id: grade.id },
        data: { studentId: enrolment.studentId },
      });
    }
    gradesMoved += 1;
  }
  console.log(`grades:      ${gradesMoved} re-keyed to a student`);

  // --------------------------------------------------------- submissions
  const submissions = await prisma.assessmentSubmission.findMany({
    where: { studentId: null, enrollmentId: { not: null } },
    select: { id: true, enrollmentId: true },
  });
  let submissionsMoved = 0;
  for (const submission of submissions) {
    if (!submission.enrollmentId) continue;
    const enrolment = await prisma.enrollment.findUnique({
      where: { id: submission.enrollmentId },
      select: { studentId: true },
    });
    if (!enrolment) continue;
    if (!DRY_RUN) {
      await prisma.assessmentSubmission.update({
        where: { id: submission.id },
        data: { studentId: enrolment.studentId },
      });
    }
    submissionsMoved += 1;
  }
  console.log(`submissions: ${submissionsMoved} re-keyed to a student`);

  // ----------------------------------------------------------- assessments
  const assessments = await prisma.assessment.findMany({
    where: { subjectOfferingId: null, classId: { not: null } },
    select: {
      id: true,
      name: true,
      tenantId: true,
      classId: true,
      academicYearId: true,
      termId: true,
    },
  });

  let matched = 0;
  const problems: string[] = [];

  for (const assessment of assessments) {
    if (!assessment.classId || !assessment.tenantId) continue;

    const klass = await prisma.class.findUnique({
      where: { id: assessment.classId },
      select: {
        id: true,
        name: true,
        section: true,
        course: { select: { subject: true, name: true } },
      },
    });
    if (!klass) {
      problems.push(`"${assessment.name}": its legacy class no longer exists`);
      continue;
    }

    const subjectLabel = klass.course?.subject || klass.course?.name || '';
    if (!subjectLabel) {
      problems.push(`"${assessment.name}": legacy class has no course subject`);
      continue;
    }

    const offerings = await prisma.subjectOffering.findMany({
      where: {
        tenantId: assessment.tenantId,
        academicYearId: assessment.academicYearId,
        status: 'active',
      },
      select: { id: true, subjectLabel: true, classSectionId: true },
    });

    // Subject must match; when the legacy class names a section, that has to
    // agree too — otherwise "Mathematics" matches every arm at once.
    const bySubject = offerings.filter(
      (o) => fold(o.subjectLabel) === fold(subjectLabel),
    );
    let candidates = bySubject;
    if (bySubject.length > 1) {
      const sections = await prisma.classSection.findMany({
        where: {
          tenantId: assessment.tenantId,
          id: { in: bySubject.map((o) => o.classSectionId) },
        },
        select: { id: true, displayLabel: true },
      });

      // The ARM is `class.section` ("JSS2-A"); `ClassSection.displayLabel` is
      // composed from level + stream + arm ("JSS2 A"), and folding makes those
      // equal. Comparing `name + section` — where `name` is a descriptive
      // "Mathematics JSS2-A" — produced "Mathematics JSS2-A JSS2-A", which can
      // never equal a section label, so every subject with more than one
      // offering was reported as "no matching offering" while the offering sat
      // right there. Try the arm first, then the older composed forms.
      const labels = [
        klass.section,
        [klass.name, klass.section].filter(Boolean).join(' '),
        klass.name,
      ].filter((label): label is string => Boolean(label?.trim()));

      for (const label of labels) {
        const wanted = sections.filter(
          (s) => fold(s.displayLabel) === fold(label),
        );
        const narrowed = bySubject.filter((o) =>
          wanted.some((s) => s.id === o.classSectionId),
        );
        if (narrowed.length === 1) {
          candidates = narrowed;
          break;
        }
        // A narrowing that is still ambiguous is better than none, but keep
        // looking for one that resolves outright.
        if (narrowed.length > 1) candidates = narrowed;
      }
      // If no label matched at all, candidates stays as `bySubject` so the
      // report says "N offerings match — attach it by hand", which is true,
      // rather than "no matching offering", which was not.
    }

    if (candidates.length === 1) {
      if (!DRY_RUN) {
        await prisma.assessment.update({
          where: { id: assessment.id },
          data: { subjectOfferingId: candidates[0]!.id },
        });
      }
      matched += 1;
      console.log(
        `  · "${assessment.name}" → ${candidates[0]!.subjectLabel} offering`,
      );
    } else {
      problems.push(
        `"${assessment.name}" (class ${klass.name}${klass.section ? ` ${klass.section}` : ''}, subject ${subjectLabel}): ` +
          (candidates.length === 0
            ? 'no matching offering for that year'
            : `${candidates.length} offerings match — attach it by hand`),
      );
    }
  }

  console.log(
    `assessments: ${matched} matched · ${problems.length} need a human`,
  );
  if (problems.length > 0) {
    console.log(
      '\nLeft alone (a wrong offering would corrupt a cohort’s marks):',
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
