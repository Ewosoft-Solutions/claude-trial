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

  const [classes, assessments] = await Promise.all([
    serverApiGet<ClassListResponse>('/classes?limit=100'),
    serverApiGet<Paginated<AssessmentSummary>>('/assessments?limit=100'),
  ]);

  const sourceClasses = classes?.data ?? [];
  const firstCourseId = sourceClasses[0]?.course?.id;
  const questions = firstCourseId
    ? await serverApiGet<QuestionSummary[]>(
        `/questions?courseId=${firstCourseId}&limit=50`,
      )
    : null;

  return (
    <AssessmentsClient
      live
      initialClasses={sourceClasses}
      initialAssessments={assessments?.data ?? []}
      initialQuestions={questions ?? []}
    />
  );
}
