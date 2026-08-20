'use client';

/* ============================================================
   NewInvoiceClient — pick who the bill is for, then compose it

   Creating an invoice used to be a drawer that collected the student, term and
   due date, created the draft, and dropped you on a detail route that could
   not edit any of them again. This route is the first half of that split, and
   it is deliberately thin: choose a student, and you land on the invoice
   itself, where the term, due date and lines are all editable in one place.

   Nothing is written until a student is chosen, so opening this route and
   changing your mind leaves no abandoned draft behind.
   ============================================================ */

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, Search } from 'lucide-react';

import { Button } from '@workspace/ui/components/button';
import { Input } from '@workspace/ui/components/input';
import { Label } from '@workspace/ui/components/label';
import { PageHeader } from '@workspace/ui/custom/shell/page-header';
import { ShellMain } from '@workspace/ui/custom/shell/app-shell';
import { EmptyState } from '@workspace/ui/custom/states/page-states';

import { authedFetch } from '@/lib/authed-fetch';
import { STEP_UP_OPERATION } from '@/lib/step-up';
import { useStepUpAction } from '../../../_shared/use-step-up-action';
import type { StudentOption } from '../student-options';

/** How many roster matches to show at once — a list, not a wall. */
const MAX_MATCHES = 12;

export function NewInvoiceClient({ students }: { students: StudentOption[] }) {
  const router = useRouter();
  const { requestStepUp, stepUpPrompt } = useStepUpAction();
  const [query, setQuery] = React.useState('');
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const matches = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool =
      q === ''
        ? students
        : students.filter(
            (s) =>
              s.name.toLowerCase().includes(q) ||
              (s.studentNumber ?? '').toLowerCase().includes(q),
          );
    return pool.slice(0, MAX_MATCHES);
  }, [students, query]);

  const create = (student: StudentOption) => {
    if (busyId) return;
    requestStepUp(
      {
        operation: STEP_UP_OPERATION.FINANCIAL_FEE_STRUCTURE_UPDATE,
        title: 'Create a fee invoice',
        description:
          'Confirm your identity to open a draft invoice. You compose its details and lines next.',
      },
      async (challengeId) => {
        setBusyId(student.id);
        try {
          const res = await authedFetch('/api/finance/invoices', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              studentId: student.id,
              amountDue: 0,
              stepUpChallengeId: challengeId,
            }),
          });
          if (!res.ok) {
            const d = (await res.json().catch(() => null)) as {
              message?: string;
            } | null;
            throw new Error(d?.message ?? `Request failed (${res.status})`);
          }
          const created = (await res.json()) as { id: string };
          // `replace`, not `push`: this route has done its one job, and Back
          // should return to the list rather than re-open a picker that would
          // open a second draft for the same student.
          router.replace(`/finance/invoices/${created.id}`);
        } catch (e) {
          toast.error(
            e instanceof Error ? e.message : 'Could not create invoice',
          );
          setBusyId(null);
        }
      },
    );
  };

  return (
    <ShellMain>
      <div className="flex flex-col gap-5">
        <div>
          <Link
            href="/finance/invoices"
            className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden /> Invoices
          </Link>
          <PageHeader
            title="New invoice"
            meta={[
              {
                key: 'step',
                label: 'Choose who this bill is for',
              },
            ]}
          />
        </div>

        <div className="flex max-w-xl flex-col gap-2">
          <Label htmlFor="ni-search">Student</Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              id="ni-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name or number…"
              autoComplete="off"
              autoFocus
              className="pl-9"
            />
          </div>
        </div>

        {matches.length === 0 ? (
          <EmptyState
            compact
            title="No student matches that"
            description="Try a different name or admission number."
          />
        ) : (
          <ul className="flex max-w-xl flex-col gap-1.5">
            {matches.map((student) => (
              <li key={student.id}>
                <Button
                  variant="outline"
                  disabled={busyId !== null}
                  onClick={() => create(student)}
                  className="h-auto w-full justify-between px-3 py-2.5 text-left"
                >
                  <span className="flex flex-col items-start gap-0.5">
                    <span className="font-medium">{student.name}</span>
                    {student.studentNumber ? (
                      <span className="text-xs text-muted-foreground">
                        {student.studentNumber}
                      </span>
                    ) : null}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {busyId === student.id ? 'Opening…' : 'Open draft'}
                  </span>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {stepUpPrompt}
    </ShellMain>
  );
}
