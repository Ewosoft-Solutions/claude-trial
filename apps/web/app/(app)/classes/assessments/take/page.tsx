import { type AssessmentSummary, type Paginated } from '@/lib/academics';
import { serverApiGet } from '@/lib/server-api';
import { AssessmentTakeListClient } from './take-list-client';

export default async function AssessmentTakePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { q } = await searchParams;
  const query = typeof q === 'string' ? q : '';

  // Search runs at the DB, not in the client — otherwise the name filter would
  // only ever see the first page of assessments and silently hide matches past
  // the cap.
  const params = new URLSearchParams({ status: 'published', limit: '100' });
  if (query) params.set('search', query);

  const assessments = await serverApiGet<Paginated<AssessmentSummary>>(
    `/assessments?${params.toString()}`,
  );

  return (
    <AssessmentTakeListClient
      live
      initialAssessments={assessments?.data ?? []}
      initialQuery={query}
    />
  );
}
