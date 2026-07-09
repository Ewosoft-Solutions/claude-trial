/* ============================================================
   /students/enrollment — admissions pipeline (server component)

   Fetches applications from the NestJS backend (server-side,
   cookie-authenticated) and passes them to EnrollmentClient.
   Empty API responses render as empty states in the client.
   ============================================================ */

import { serverApiGet } from '@/lib/server-api';
import { EnrollmentClient, type Applicant } from './enrollment-client';

interface ApiApplication {
  id: string;
  applicantName: string;
  applyingFor: string;
  guardianName: string;
  submittedDate: string;
  stage: string;
  decision: string;
}

function formatDate(iso: string | null | undefined): string | undefined {
  if (!iso) return undefined;
  try {
    return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short' }).format(new Date(iso));
  } catch {
    return undefined;
  }
}

export default async function EnrollmentPage() {
  const data = await serverApiGet<ApiApplication[] | { data?: ApiApplication[] }>(
    '/admissions/applications',
  );

  const raw: ApiApplication[] = Array.isArray(data)
    ? data
    : (data as { data?: ApiApplication[] } | null)?.data ?? [];

  const applicants: Applicant[] = raw.map((a) => ({
    id: a.id,
    name: a.applicantName,
    applyingFor: a.applyingFor,
    submitted: formatDate(a.submittedDate) ?? '',
    guardian: a.guardianName,
    stage: a.stage as Applicant['stage'],
    decision: a.decision as Applicant['decision'],
  }));

  return <EnrollmentClient applicants={applicants} />;
}
