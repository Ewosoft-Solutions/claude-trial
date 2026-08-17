/**
 * WB4-4 · Transcripts — a student's cumulative academic record, assembled from
 * published (non-superseded) result snapshots only.
 *
 * Its own route rather than a panel inside the results workbench: a transcript
 * is not scoped to one result cycle (it spans every published term), and issuing
 * one is a separate responsibility from running a term. Reads gated
 * `academics.results.view`; issuing the artifact needs `.manage`, enforced
 * server-side.
 */
import { getSession } from '@/lib/session';
import { serverApiGet } from '@/lib/server-api';
import { PermissionDeniedState } from '@workspace/ui/custom/states/page-states';
import { ShellMain } from '@workspace/ui/custom/shell/app-shell';
import { PageHeader } from '@workspace/ui/custom/shell/page-header';

import {
  TranscriptPanel,
  type TranscriptStudentOption,
} from './transcript-panel';

export const dynamic = 'force-dynamic';

function toArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  const data = (value as { data?: unknown } | null)?.data;
  return Array.isArray(data) ? (data as T[]) : [];
}

export default async function TranscriptsPage() {
  const session = await getSession();
  const permissions = session?.permissions ?? [];
  if (!permissions.includes('academics.results.view')) {
    return (
      <ShellMain>
        <PermissionDeniedState
          title="You don't have access to transcripts"
          description="Ask an administrator for the “View results” permission."
        />
      </ShellMain>
    );
  }

  // /students caps `limit` at 100 (PaginationDto @Max(100)) — a higher value is
  // rejected 400 and serverApiGet returns null, blanking the picker.
  const studentsRaw = await serverApiGet<unknown>('/students?limit=100');

  return (
    <ShellMain>
      <PageHeader
        title="Transcripts"
        description="A student’s cumulative record across every published term — read from the immutable snapshots, not the live gradebook, so it reproduces years later."
      />
      <TranscriptPanel
        students={toArray<TranscriptStudentOption>(studentsRaw)}
        canManage={permissions.includes('academics.results.manage')}
      />
    </ShellMain>
  );
}
