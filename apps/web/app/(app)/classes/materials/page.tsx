import type { ClassSummary, LessonSummary } from '@/lib/academics';
import { serverApiGet } from '@/lib/server-api';
import { MaterialsClient } from './materials-client';

interface ClassListResponse {
  data: ClassSummary[];
}

export default async function MaterialsPage() {
  const [classes, lessons] = await Promise.all([
    serverApiGet<ClassListResponse>('/classes?limit=100'),
    serverApiGet<LessonSummary[]>('/learning/lessons'),
  ]);

  return (
    <MaterialsClient
      live
      initialClasses={classes?.data ?? []}
      initialLessons={lessons ?? []}
    />
  );
}
