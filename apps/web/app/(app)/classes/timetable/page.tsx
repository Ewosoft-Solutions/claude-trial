import { serverApiGet } from '@/lib/server-api';
import { TimetableClient, type TimetableClass } from './timetable-client';

type Paginated<T> = { data?: T[] };

interface ApiClass {
  id: string;
  name?: string | null;
  section?: string | null;
  room?: string | null;
  schedule?: unknown;
  course?: { name?: string | null; code?: string | null } | null;
  term?: { name?: string | null } | null;
}

interface ScheduleSlot {
  day?: string;
  startTime?: string;
  endTime?: string;
  room?: string;
}

function asArray<T>(payload: T[] | Paginated<T> | null): T[] {
  if (Array.isArray(payload)) return payload;
  return payload?.data ?? [];
}

function scheduleSlots(schedule: unknown): ScheduleSlot[] {
  if (!Array.isArray(schedule)) return [];
  return schedule.filter((slot): slot is ScheduleSlot => {
    if (!slot || typeof slot !== 'object') return false;
    const candidate = slot as ScheduleSlot;
    return Boolean(candidate.day && candidate.startTime);
  });
}

function classLabel(cls: ApiClass): string {
  return [cls.name, cls.section].filter(Boolean).join(' ') || cls.course?.name || cls.id;
}

export default async function TimetablePage() {
  const data = await serverApiGet<ApiClass[] | Paginated<ApiClass>>('/classes?limit=200');
  const classes: TimetableClass[] = asArray(data).map((cls) => ({
    id: cls.id,
    label: classLabel(cls),
    subject: cls.course?.name ?? cls.course?.code ?? classLabel(cls),
    term: cls.term?.name ?? undefined,
    room: cls.room ?? undefined,
    schedule: scheduleSlots(cls.schedule),
  }));

  return <TimetableClient classes={classes} />;
}
