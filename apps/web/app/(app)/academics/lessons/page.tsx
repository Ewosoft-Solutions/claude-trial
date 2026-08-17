/**
 * Lesson library — the curriculum-level content library and the per-class plans
 * that point at it (alignment step 2).
 *
 * Lives under Academics rather than Classes because a library lesson belongs to
 * a SUBJECT, not to one class: it is authored once and taught by every section
 * that offers that subject. The per-class plan is the other half, and sits here
 * beside it so the relationship between the two is visible in one place.
 *
 * Reads need `lessons.view`; authoring needs `lessons.create` — enforced
 * server-side, and additionally scoped there to teachers of that subject.
 */
import { getSession } from '@/lib/session';
import { serverApiGet } from '@/lib/server-api';
import { PermissionDeniedState } from '@workspace/ui/custom/states/page-states';
import { ShellMain } from '@workspace/ui/custom/shell/app-shell';

import {
  LessonLibraryClient,
  type OfferingOption,
  type SectionOption,
  type SubjectOption,
} from './lesson-library-client';

export const dynamic = 'force-dynamic';

interface OfferableSubject {
  id: string;
  name: string;
  versionName?: string | null;
}

export default async function LessonLibraryPage() {
  const session = await getSession();
  const permissions = session?.permissions ?? [];
  if (!permissions.includes('lessons.view')) {
    return (
      <ShellMain>
        <PermissionDeniedState
          title="You don't have access to lessons"
          description="Ask an administrator for the “View lessons” permission."
        />
      </ShellMain>
    );
  }

  const [subjects, offerings, sections] = await Promise.all([
    serverApiGet<OfferableSubject[]>('/academics/structure/offerable-subjects'),
    serverApiGet<OfferingOption[]>('/academics/structure/offerings'),
    serverApiGet<SectionOption[]>('/academics/structure/sections'),
  ]);

  return (
    <LessonLibraryClient
      subjects={
        (subjects ?? []).map((s) => ({
          id: s.id,
          name: s.name,
          versionName: s.versionName,
        })) as SubjectOption[]
      }
      offerings={offerings ?? []}
      sections={sections ?? []}
      canCreate={permissions.includes('lessons.create')}
    />
  );
}
