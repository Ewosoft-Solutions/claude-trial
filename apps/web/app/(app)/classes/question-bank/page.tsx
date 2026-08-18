import { type QuestionSummary, type SubjectSummary } from '@/lib/academics';
import { serverApiGet } from '@/lib/server-api';
import { QuestionBankClient } from './question-bank-client';

export default async function QuestionBankPage() {
  // The bank belongs to a CURRICULUM SUBJECT, not the legacy course: it
  // outlives any one course, class or section, which is the whole point of a
  // bank. `/questions/subjects` is already narrowed to the caller's teaching
  // assignments and answers with `questions.view`, so a teacher does not need
  // the registrar's structure permission just to fill this picker.
  const subjects =
    (await serverApiGet<SubjectSummary[]>('/questions/subjects')) ?? [];
  const firstSubjectId = subjects[0]?.id;

  // Questions are per-subject (a bounded set), so a generous cap covers the
  // whole bank and the client's in-memory search is complete — unlike
  // assessments, which span every offering and are scoped per-offering at the
  // DB instead.
  const questions = firstSubjectId
    ? await serverApiGet<QuestionSummary[]>(
        `/questions?curriculumSubjectId=${firstSubjectId}&limit=100`,
      )
    : null;

  return (
    <QuestionBankClient
      live
      initialSubjects={subjects}
      initialQuestions={questions ?? []}
    />
  );
}
