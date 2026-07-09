/* ============================================================
   /classes/tutor — Academic AI tutor (server component)

   Fetches the lessons the student may study from (backend applies the
   published + approved + enrolled visibility rules) and the student's own
   tutor sessions, then hands them to the client island. Honest empty states
   when there are no lessons or no history.
   ============================================================ */

import type { LessonSummary } from '@/lib/academics';
import { serverApiGet } from '@/lib/server-api';
import { TutorClient, type TutorSessionSummary } from './tutor-client';

export default async function TutorPage() {
  const [lessons, sessions] = await Promise.all([
    serverApiGet<LessonSummary[]>('/learning/lessons'),
    serverApiGet<TutorSessionSummary[]>('/ai/academic/sessions'),
  ]);

  return (
    <TutorClient
      initialLessons={lessons ?? []}
      initialSessions={sessions ?? []}
    />
  );
}
