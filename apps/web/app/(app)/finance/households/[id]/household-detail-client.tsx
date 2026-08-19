'use client';

/* ============================================================
   HouseholdDetailClient — members + payers + merge for one household
   ============================================================ */

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, Plus, UserMinus } from 'lucide-react';

import { Button } from '@workspace/ui/components/button';
import { Input } from '@workspace/ui/components/input';
import { Label } from '@workspace/ui/components/label';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@workspace/ui/components/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select';
import { PageHeader } from '@workspace/ui/custom/shell/page-header';
import { ShellMain } from '@workspace/ui/custom/shell/app-shell';
import { DataTableLayout } from '@workspace/ui/custom/layouts/data-table-layout';
import { EmptyState } from '@workspace/ui/custom/states/page-states';
import { StatusBadge } from '@workspace/ui/custom/data-display/status-badge';

import { authedFetch } from '@/lib/authed-fetch';
import { formatNaira as nairaFromKobo } from '@/lib/format';
import { isSearchable } from '@/lib/input-validation';

export interface StudentOption {
  id: string;
  name: string;
  studentNumber?: string;
}
export interface HouseholdOption {
  id: string;
  name: string;
}

interface Member {
  id: string;
  studentId: string;
  studentName?: string | null;
  effectiveTo?: string | null;
}
interface Payer {
  id: string;
  guardianId: string;
  payerName?: string | null;
  role: string;
  effectiveTo?: string | null;
}
/** The money side of a family account: what is owed, and what is held. */
export interface AccountStanding {
  outstanding: number;
  credit: number;
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    studentName?: string;
    dueDate?: string;
    balance: number;
  }>;
}

export interface ApiHouseholdDetail {
  id: string;
  name: string;
  primaryPayerName?: string | null;
  derivedFromGuardianId?: string | null;
  members: Member[];
  payers: Payer[];
}

async function mutate(
  url: string,
  method: 'POST' | 'DELETE',
  body?: unknown,
): Promise<void> {
  const res = await authedFetch(url, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const d = (await res.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new Error(d?.message ?? `Request failed (${res.status})`);
  }
}

export function HouseholdDetailClient({
  household,
  students,
  otherHouseholds,
  standing,
  canManage,
}: {
  household: ApiHouseholdDetail;
  students: StudentOption[];
  otherHouseholds: HouseholdOption[];
  standing: AccountStanding;
  canManage: boolean;
}) {
  const activeMembers = household.members.filter((m) => !m.effectiveTo);
  const activePayers = household.payers.filter((p) => !p.effectiveTo);
  const memberStudentIds = new Set(activeMembers.map((m) => m.studentId));
  const pickable = students.filter((s) => !memberStudentIds.has(s.id));

  return (
    <ShellMain>
      <div className="flex flex-col gap-5">
        <div>
          <Link
            href="/finance/households"
            className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden /> Households
          </Link>
          <PageHeader
            title={household.name}
            meta={[
              {
                key: 'members',
                label: `${activeMembers.length} ${activeMembers.length === 1 ? 'student' : 'students'}`,
                emphasis: true,
              },
              {
                key: 'payers',
                label: `${activePayers.length} ${activePayers.length === 1 ? 'payer' : 'payers'}`,
              },
            ]}
            actions={
              household.derivedFromGuardianId ? (
                <StatusBadge tone="info">Auto-derived</StatusBadge>
              ) : (
                <StatusBadge tone="neutral">Manual</StatusBadge>
              )
            }
          />
        </div>

        <SectionCard
          title="Account standing"
          description="What this family owes, and anything they have paid ahead."
          action={
            canManage ? (
              <Button size="sm" variant="outline" asChild>
                <Link href="/finance/payments">Record payment</Link>
              </Button>
            ) : undefined
          }
        >
          <div className="flex flex-col gap-3">
            <div className="grid gap-3 @md/main:grid-cols-2">
              <div className="rounded-lg border border-border bg-card/40 p-3">
                <p className="text-xs text-muted-foreground">Outstanding</p>
                <p className="text-lg font-medium tabular-nums text-foreground">
                  {nairaFromKobo(standing.outstanding)}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-card/40 p-3">
                <p className="text-xs text-muted-foreground">
                  Credit held — applied to their next invoice
                </p>
                <p className="text-lg font-medium tabular-nums text-foreground">
                  {nairaFromKobo(standing.credit)}
                </p>
              </div>
            </div>

            {standing.invoices.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing outstanding on this family account.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {standing.invoices.map((invoice) => (
                  <li
                    key={invoice.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card/40 p-2.5"
                  >
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-medium text-foreground">
                        {invoice.studentName ?? 'Unnamed student'}
                      </span>
                      <Link
                        href={`/finance/invoices/${invoice.id}`}
                        className="truncate text-xs text-muted-foreground hover:underline"
                      >
                        {invoice.invoiceNumber}
                      </Link>
                    </div>
                    <span className="tabular-nums text-sm text-foreground">
                      {nairaFromKobo(invoice.balance)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="Payers"
          description="Guardians responsible for this family's fees."
          action={
            canManage ? (
              <AddPayerDialog householdId={household.id} />
            ) : undefined
          }
          empty={activePayers.length === 0}
          emptyState={
            <EmptyState
              compact
              title="No payers"
              description="Add a guardian."
            />
          }
        >
          <ul className="divide-y divide-border">
            {activePayers.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">
                    {p.payerName ?? p.guardianId}
                  </span>
                  <StatusBadge
                    tone={p.role === 'primary' ? 'success' : 'neutral'}
                  >
                    {p.role}
                  </StatusBadge>
                </div>
                {canManage ? (
                  <EndButton
                    url={`/api/finance/households/payers/${p.id}`}
                    label="Remove payer"
                  />
                ) : null}
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard
          title="Students"
          description="Children billed under this household."
          action={
            canManage ? (
              <AddMemberDialog householdId={household.id} students={pickable} />
            ) : undefined
          }
          empty={activeMembers.length === 0}
          emptyState={
            <EmptyState
              compact
              title="No students"
              description="Add a student to this household."
            />
          }
        >
          <ul className="divide-y divide-border">
            {activeMembers.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6"
              >
                <span className="font-medium text-foreground">
                  {m.studentName ?? m.studentId}
                </span>
                {canManage ? (
                  <EndButton
                    url={`/api/finance/households/members/${m.id}`}
                    label="Remove student"
                  />
                ) : null}
              </li>
            ))}
          </ul>
        </SectionCard>

        {canManage && otherHouseholds.length > 0 ? (
          <SectionCard
            title="Merge"
            description="Absorb another household into this one (its students, payers and invoices move here; it is then removed)."
          >
            <div className="px-4 py-3 sm:px-6">
              <MergeControl
                householdId={household.id}
                others={otherHouseholds}
              />
            </div>
          </SectionCard>
        ) : null}
      </div>
    </ShellMain>
  );
}

/** A titled section framed by the shared table shell, so every card, header
 *  gutter and row padding matches the app's lists. */
function SectionCard({
  title,
  description,
  action,
  empty,
  emptyState,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  empty?: boolean;
  emptyState?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <DataTableLayout
      title={title}
      description={description}
      toolbar={action}
      empty={empty}
      emptyState={emptyState}
    >
      {children}
    </DataTableLayout>
  );
}

function EndButton({ url, label }: { url: string; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
      disabled={busy}
      aria-label={label}
      onClick={async () => {
        setBusy(true);
        try {
          await mutate(url, 'DELETE');
          toast.success('Removed (kept in history)');
          router.refresh();
        } catch (e) {
          toast.error(e instanceof Error ? e.message : 'Remove failed');
        } finally {
          setBusy(false);
        }
      }}
    >
      <UserMinus className="size-4" aria-hidden /> Remove
    </Button>
  );
}

function AddMemberDialog({
  householdId,
  students,
}: {
  householdId: string;
  students: StudentOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (open) setQuery('');
  }, [open]);

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
    return pool.slice(0, 8);
  }, [students, query]);

  const add = async (s: StudentOption) => {
    setBusy(true);
    try {
      await mutate(`/api/finance/households/${householdId}/members`, 'POST', {
        studentId: s.id,
        studentName: s.name,
      });
      toast.success('Student added');
      setOpen(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Add failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus aria-hidden /> Add student
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a student</DialogTitle>
          <DialogDescription>
            Search the roster and pick a student to bill under this household.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 py-2">
          <Label htmlFor="add-student">Student</Label>
          <Input
            id="add-student"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name or number…"
            autoComplete="off"
          />
          <div className="max-h-52 overflow-y-auto">
            {matches.length === 0 ? (
              <p className="px-1 py-2 text-xs text-muted-foreground">
                No matching students.
              </p>
            ) : (
              <ul className="flex flex-col gap-1">
                {matches.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => add(s)}
                      className="flex w-full items-center justify-between gap-2 rounded-md border border-border bg-card/60 px-2.5 py-1.5 text-left text-sm hover:border-ring/60 hover:bg-accent/40 disabled:opacity-50"
                    >
                      <span className="truncate">{s.name}</span>
                      {s.studentNumber ? (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {s.studentNumber}
                        </span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" size="sm">
              Done
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddPayerDialog({ householdId }: { householdId: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [term, setTerm] = React.useState('');
  const [results, setResults] = React.useState<{ id: string; name: string }[]>(
    [],
  );
  const [searching, setSearching] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const seq = React.useRef(0);

  React.useEffect(() => {
    if (open) {
      setTerm('');
      setResults([]);
    }
  }, [open]);

  React.useEffect(() => {
    const q = term.trim();
    if (!isSearchable(q)) {
      setResults([]);
      setSearching(false);
      return;
    }
    const mySeq = ++seq.current;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/directory/people?type=guardian&match=name&q=${encodeURIComponent(q)}&limit=8`,
          { cache: 'no-store' },
        );
        const data = (await res.json()) as {
          data?: { id: string; name: string }[];
        };
        if (mySeq !== seq.current) return;
        setResults(data.data ?? []);
      } catch {
        if (mySeq === seq.current) setResults([]);
      } finally {
        if (mySeq === seq.current) setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [term]);

  const add = async (guardian: { id: string; name: string }) => {
    setBusy(true);
    try {
      await mutate(`/api/finance/households/${householdId}/payers`, 'POST', {
        guardianId: guardian.id,
        payerName: guardian.name,
        role: 'secondary',
      });
      toast.success('Payer added');
      setOpen(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Add failed');
    } finally {
      setBusy(false);
    }
  };

  const q = term.trim();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Plus aria-hidden /> Add payer
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a payer</DialogTitle>
          <DialogDescription>
            Search guardians and add one as a secondary payer.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 py-2">
          <Label htmlFor="add-payer">Guardian</Label>
          <Input
            id="add-payer"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search name…"
            autoComplete="off"
          />
          <div className="h-52 overflow-y-auto">
            {!isSearchable(q) ? (
              <p className="px-1 py-2 text-xs text-muted-foreground">
                Type at least 2 letters to search.
              </p>
            ) : searching ? (
              <p className="flex items-center gap-1.5 px-1 py-2 text-xs text-muted-foreground">
                <Loader2 className="size-3 animate-spin" aria-hidden />{' '}
                Searching…
              </p>
            ) : results.length > 0 ? (
              <ul className="flex flex-col gap-1">
                {results.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => add(r)}
                      className="flex w-full items-center gap-2 rounded-md border border-border bg-card/60 px-2.5 py-1.5 text-left text-sm capitalize hover:border-ring/60 hover:bg-accent/40 disabled:opacity-50"
                    >
                      {r.name}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-1 py-2 text-xs text-muted-foreground">
                No matches.
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" size="sm">
              Done
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MergeControl({
  householdId,
  others,
}: {
  householdId: string;
  others: HouseholdOption[];
}) {
  const router = useRouter();
  const [sourceId, setSourceId] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex min-w-56 flex-1 flex-col gap-1.5">
        <Label htmlFor="merge-source">Absorb household</Label>
        <Select value={sourceId} onValueChange={setSourceId}>
          <SelectTrigger id="merge-source">
            <SelectValue placeholder="Choose a household to merge in" />
          </SelectTrigger>
          <SelectContent>
            {others.map((h) => (
              <SelectItem key={h.id} value={h.id}>
                {h.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button
        variant="outline"
        size="sm"
        disabled={!sourceId || busy}
        onClick={async () => {
          setBusy(true);
          try {
            await mutate(
              `/api/finance/households/${householdId}/merge`,
              'POST',
              { sourceHouseholdId: sourceId },
            );
            toast.success('Households merged');
            setSourceId('');
            router.refresh();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Merge failed');
          } finally {
            setBusy(false);
          }
        }}
      >
        Merge in
      </Button>
    </div>
  );
}
