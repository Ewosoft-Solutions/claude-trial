import {
  type CourseSummary,
  type QuestionSummary,
} from '@/lib/academics';
import { serverApiGet } from '@/lib/server-api';
import { QuestionBankClient } from './question-bank-client';

export default async function QuestionBankPage() {
  const courses = await serverApiGet<CourseSummary[]>('/courses?status=active');
  const sourceCourses = courses ?? [];
  const firstCourseId = sourceCourses[0]?.id;

  const questions = firstCourseId
    ? await serverApiGet<QuestionSummary[]>(
        `/questions?courseId=${firstCourseId}&limit=50`,
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
