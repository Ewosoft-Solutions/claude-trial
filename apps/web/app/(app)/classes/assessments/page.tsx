import {
  type AssessmentSummary,
  type ClassSummary,
  type Paginated,
  type QuestionSummary,
} from '@/lib/academics';
import { requirePermission } from '@/lib/access';
import { serverApiGet } from '@/lib/server-api';
import { AssessmentsClient } from './assessments-client';

interface ClassListResponse {
  data: ClassSummary[];
}

export default async function AssessmentsPage() {
  await requirePermission('assessments.view');

  const classes = await serverApiGet<ClassListResponse>('/classes?limit=100');
  const sourceClasses = classes?.data ?? [];
  const firstClass = sourceClasses[0];
  const firstCourseId = firstClass?.course?.id;

  // Assessments are scoped to the selected class at the DB (the workbench is
  // class-scoped); the client refetches on class change. This avoids fetching
  // one capped page of ALL classes and filtering it in the client, which would
  // hide a class's assessments once the tenant has more than a page of them.
  const [assessments, questions] = await Promise.all([
    firstClass
      ? serverApiGet<Paginated<AssessmentSummary>>(
          `/assessments?classId=${firstClass.id}&limit=100`,
        )
      : Promise.resolve(null),
    firstCourseId
      ? serverApiGet<QuestionSummary[]>(
          `/questions?courseId=${firstCourseId}&limit=100`,
        )
      : Promise.resolve(null),
  ]);

  return (
    <AssessmentsClient
      live
      initialClasses={sourceClasses}
      initialAssessments={assessments?.data ?? []}
      initialQuestions={questions ?? []}
    />
  );
}
