import { type CourseSummary, type QuestionSummary } from '@/lib/academics';
import { serverApiGet } from '@/lib/server-api';
import { QuestionBankClient } from './question-bank-client';

export default async function QuestionBankPage() {
  const courses = await serverApiGet<CourseSummary[]>('/courses?status=active');
  const sourceCourses = courses ?? [];
  const firstCourseId = sourceCourses[0]?.id;

  // Questions are per-course (a bounded set), so a generous cap covers the whole
  // bank and the client's in-memory search is complete — unlike assessments,
  // which span every class and are scoped per-class at the DB instead.
  const questions = firstCourseId
    ? await serverApiGet<QuestionSummary[]>(
        `/questions?courseId=${firstCourseId}&limit=100`,
      )
    : null;

  return (
    <QuestionBankClient
      live
      initialCourses={sourceCourses}
      initialQuestions={questions ?? []}
    />
  );
}
