import {
  type AssessmentSubmission,
  type StudentPaper,
} from '@/lib/academics';
import { serverApiGet } from '@/lib/server-api';
import { TakeAssessmentClient } from './take-assessment-client';

export default async function TakeAssessmentByIdPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [paper, submissions] = await Promise.all([
    serverApiGet<StudentPaper>(`/assessments/${id}/take`),
    serverApiGet<AssessmentSubmission[]>(`/assessments/${id}/submissions/mine`),
  ]);

  return (
    <TakeAssessmentClient
      assessmentId={id}
      initialPaper={paper ?? null}
      initialSubmissions={submissions ?? []}
    />
  );
}
