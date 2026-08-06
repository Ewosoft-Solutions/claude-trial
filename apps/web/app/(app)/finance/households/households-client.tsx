'use client';

/* ============================================================
   HouseholdsClient — the tenant's billing households (family accounts)
   ============================================================ */

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, Sparkles } from 'lucide-react';

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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@workspace/ui/components/table';
import { PageHeader } from '@workspace/ui/custom/shell/page-header';
import { ShellMain } from '@workspace/ui/custom/shell/app-shell';
import { DataTableLayout } from '@workspace/ui/custom/layouts/data-table-layout';
import { EmptyState } from '@workspace/ui/custom/states/page-states';
import { StatusBadge } from '@workspace/ui/custom/data-display/status-badge';

import { authedFetch } from '@/lib/authed-fetch';

interface ApiMember {
  id: string;
  studentId: string;
  studentName?: string | null;
  effectiveTo?: string | null;
}
interface ApiPayer {
  id: string;
  guardianId: string;
  payerName?: string | null;
  role: string;
  effectiveTo?: string | null;
}
export interface ApiHousehold {
  id: string;
  name: string;
  primaryPayerName?: string | null;
  derivedFromGuardianId?: string | null;
  members: ApiMember[];
  payers: ApiPayer[];
}

export function HouseholdsClient({
  households,
  canManage,
}: {
  households: ApiHousehold[];
  canManage: boolean;
}) {
  return (
    <ShellMain>
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Households"
          actions={
            canManage ? (
              <>
                <AutoDeriveButton />
                <NewHouseholdDialog />
              </>
            ) : undefined
          }
        />

        <DataTableLayout
          title="Family accounts"
          description={`${households.length} ${households.length === 1 ? 'household' : 'households'}`}
          empty={households.length === 0}
          emptyState={
            <EmptyState
              compact
              title="No households yet"
              description={
                canManage
                  ? 'Auto-derive from guardian relationships, or create one by hand.'
                  : 'No billing households configured.'
              }
            />
          }
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Household</TableHead>
                <TableHead>Primary payer</TableHead>
                <TableHead className="text-right">Students</TableHead>
                <TableHead className="text-right">Payers</TableHead>
                <TableHead>Source</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {households.map((h) => (
                <TableRow key={h.id}>
                  <TableCell className="font-medium text-foreground">
                    <Link
                      href={`/finance/households/${h.id}`}
                      className="hover:underline"
                    >
                      {h.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {h.primaryPayerName ??
                      h.payers.find((p) => p.role === 'primary')?.payerName ??
                      '—'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {h.members.length}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {h.payers.length}
                  </TableCell>
                  <TableCell>
                    {h.derivedFromGuardianId ? (
                      <StatusBadge tone="info">Auto</StatusBadge>
                    ) : (
                      <StatusBadge tone="neutral">Manual</StatusBadge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataTableLayout>
      </div>
    </ShellMain>
  );
}

function AutoDeriveButton() {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const res = await authedFetch('/api/finance/households/derive', {
            method: 'POST',
          });
          if (!res.ok) throw new Error(`Request failed (${res.status})`);
          const r = (await res.json()) as { created: number; skipped: number };
          toast.success(
            `Auto-derive: ${r.created} created, ${r.skipped} already existed`,
          );
          router.refresh();
        } catch (e) {
          toast.error(e instanceof Error ? e.message : 'Auto-derive failed');
        } finally {
          setBusy(false);
        }
      }}
    >
      <Sparkles aria-hidden /> Auto-derive
    </Button>
  );
}

function NewHouseholdDialog() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState('');
  const [payer, setPayer] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setName('');
      setPayer('');
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus aria-hidden /> New household
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a household</DialogTitle>
          <DialogDescription>
            A family billing account. Add students and payers on the next
            screen.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="hh-name">Name</Label>
            <Input
              id="hh-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Okafor family"
              autoComplete="off"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="hh-payer">
              Primary payer name{' '}
              <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="hh-payer"
              value={payer}
              onChange={(e) => setPayer(e.target.value)}
              placeholder="Mrs. Amaka Okafor"
              autoComplete="off"
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" size="sm">
              Cancel
            </Button>
          </DialogClose>
          <Button
            size="sm"
            disabled={name.trim() === '' || busy}
            onClick={async () => {
              setBusy(true);
              try {
                const res = await authedFetch('/api/finance/households', {
                  method: 'POST',
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify({
                    name: name.trim(),
                    primaryPayerName: payer.trim() || undefined,
                  }),
                });
                if (!res.ok) {
                  const d = (await res.json().catch(() => null)) as {
                    message?: string;
                  } | null;
                  throw new Error(
                    d?.message ?? `Request failed (${res.status})`,
                  );
                }
                const created = (await res.json()) as { id: string };
                toast.success('Household created');
                setOpen(false);
                router.push(`/finance/households/${created.id}`);
              } catch (e) {
                toast.error(e instanceof Error ? e.message : 'Create failed');
              } finally {
                setBusy(false);
              }
            }}
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
