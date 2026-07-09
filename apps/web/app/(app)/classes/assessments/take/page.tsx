import { type AssessmentSummary, type Paginated } from '@/lib/academics';
import { serverApiGet } from '@/lib/server-api';
import { AssessmentTakeListClient } from './take-list-client';

export default async function AssessmentTakePage() {
  const assessments = await serverApiGet<Paginated<AssessmentSummary>>(
    '/assessments?status=published&limit=100',
  );

  return (
    <AssessmentTakeListClient
      live
      initialAssessments={assessments?.data ?? []}
    />
  );
}
