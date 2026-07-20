import { serverApiGet } from '@/lib/server-api';
import { SubjectsClient, type Subject } from './subjects-client';

type Paginated<T> = { data?: T[] };

interface ApiCourse {
  id: string;
  code?: string | null;
  name?: string | null;
  category?: string | null;
  subject?: string | null;
  gradeLevels?: string[] | null;
  status?: 'active' | 'draft' | 'archived' | string | null;
}

interface ApiClass {
  id: string;
  courseId?: string | null;
  schedule?: unknown;
}

function asArray<T>(payload: T[] | Paginated<T> | null): T[] {
  if (Array.isArray(payload)) return payload;
  return payload?.data ?? [];
}

function scheduleLength(schedule: unknown): number {
  return Array.isArray(schedule) ? schedule.length : 0;
}

function levelFromGrades(grades: string[] | null | undefined): Subject['level'] {
  if (!grades?.length) return 'all';
  if (grades.some((grade) => grade.toUpperCase().startsWith('SSS'))) return 'senior';
  if (grades.some((grade) => grade.toUpperCase().startsWith('JSS'))) return 'junior';
  return 'all';
}

export default async function SubjectsPage() {
  const [courseData, classData] = await Promise.all([
    serverApiGet<ApiCourse[]>('/courses'),
    serverApiGet<ApiClass[] | Paginated<ApiClass>>('/classes?limit=500'),
  ]);

  const classes = asArray(classData);
  const classesByCourse = new Map<string, ApiClass[]>();
  for (const cls of classes) {
    if (!cls.courseId) continue;
    const list = classesByCourse.get(cls.courseId) ?? [];
    list.push(cls);
    classesByCourse.set(cls.courseId, list);
  }

  const subjects: Subject[] = (courseData ?? []).map((course) => {
    const courseClasses = classesByCourse.get(course.id) ?? [];
    return {
      id: course.id,
      code: course.code ?? course.id,
      name: course.name ?? course.subject ?? course.code ?? course.id,
      category: course.category ?? course.subject ?? 'Uncategorised',
      classes: courseClasses.length,
      periods: courseClasses.reduce((sum, cls) => sum + scheduleLength(cls.schedule), 0),
      level: levelFromGrades(course.gradeLevels),
      status: course.status === 'draft' || course.status === 'archived' ? course.status : 'active',
    };
  });

  return <SubjectsClient subjects={subjects} />;
}
