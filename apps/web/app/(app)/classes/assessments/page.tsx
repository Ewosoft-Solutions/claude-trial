import {
  type AssessmentSummary,
  type OfferingSummary,
  type Paginated,
  type QuestionSummary,
} from '@/lib/academics';
import { requirePermission } from '@/lib/access';
import { serverApiGet } from '@/lib/server-api';
import { AssessmentsClient } from './assessments-client';

export default async function AssessmentsPage() {
  await requirePermission('assessments.view');

  // The workbench is keyed on the SUBJECT OFFERING (section × subject ×
  // year/term), not the legacy Class. `/assessments/offerings` is already
  // narrowed to the caller's teaching assignments and answers with
  // `assessments.view`, so a teacher does not need the registrar's structure
  // permission just to fill this picker.
  const offerings =
    (await serverApiGet<OfferingSummary[]>('/assessments/offerings')) ?? [];
  const firstOffering = offerings[0];

  // Assessments are scoped to the selected offering at the DB; the client
  // refetches when the offering changes. This avoids fetching one capped page
  // of ALL offerings and filtering it in the client, which would hide a
  // subject's assessments once the tenant has more than a page of them.
  const assessments = firstOffering
    ? await serverApiGet<Paginated<AssessmentSummary>>(
        `/assessments?subjectOfferingId=${firstOffering.id}&limit=100`,
      )
    : null;

  // The question bank is still scoped to the legacy Course, which an offering
  // has no bridge to, so there is nothing to preload for a structured subject.
  // The client says so in place rather than showing an empty picker.
  const questions: QuestionSummary[] = [];

  return (
    <AssessmentsClient
      live
      initialOfferings={offerings}
      initialAssessments={assessments?.data ?? []}
      initialQuestions={questions}
    />
  );
}
