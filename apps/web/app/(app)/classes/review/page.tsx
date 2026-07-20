import type { LessonSummary, MaterialSummary } from '@/lib/academics';
import { serverApiGet } from '@/lib/server-api';
import { AcademicReviewClient, type ReviewItem } from './review-client';

function makeItems(
  lessons: LessonSummary[],
  materialsByLesson: Record<string, MaterialSummary[]>,
): ReviewItem[] {
  return lessons.flatMap((lesson) => {
    const lessonItems: ReviewItem[] = [
      {
        key: `lesson:${lesson.id}`,
        type: 'lesson',
        lesson,
      },
    ];
    const materialItems = (materialsByLesson[lesson.id] ?? []).map((material) => ({
      key: `material:${material.id}`,
      type: 'material' as const,
      lesson,
      material,
    }));
    return [...lessonItems, ...materialItems];
  });
}

export default async function AcademicReviewPage() {
  const lessons = await serverApiGet<LessonSummary[]>('/learning/lessons');

  const sourceLessons = lessons ?? [];
  const materialsByLesson: Record<string, MaterialSummary[]> = {};

  await Promise.all(
    sourceLessons.map(async (lesson) => {
      const materials = await serverApiGet<MaterialSummary[]>(
        `/learning/lessons/${lesson.id}/materials`,
      );
      materialsByLesson[lesson.id] = materials ?? [];
    }),
  );

  const items = makeItems(sourceLessons, materialsByLesson);

  return <AcademicReviewClient live initialItems={items} />;
}
