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
import { PageHeader } from '@workspace/ui/custom/shell/page-header';
import { ShellMain } from '@workspace/ui/custom/shell/app-shell';
import {
  DirectoryTable,
  type DirectoryColumn,
} from '@workspace/ui/custom/tables/directory-table';
import { EmptyState } from '@workspace/ui/custom/states/page-states';
import { StatusBadge } from '@workspace/ui/custom/data-display/status-badge';
import type { DirectorySort } from '@workspace/ui/lib/directory-state';

import { authedFetch } from '@/lib/authed-fetch';
import { DEFAULT_PAGE_SIZE } from '@/lib/page-size';

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

function primaryPayer(h: ApiHousehold): string | null {
  return (
    h.primaryPayerName ??
    h.payers.find((p) => p.role === 'primary')?.payerName ??
    null
  );
}

export function HouseholdsClient({
  households,
  canManage,
}: {
  households: ApiHousehold[];
  canManage: boolean;
}) {
  const [term, setTerm] = React.useState('');
  const [filters, setFilters] = React.useState<
    Record<string, string | null | undefined>
  >({});
  const [sort, setSort] = React.useState<DirectorySort | null>(null);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(DEFAULT_PAGE_SIZE);

  React.useEffect(() => setPage(1), [term, filters, pageSize]);

  const columns: DirectoryColumn<ApiHousehold>[] = [
    {
      id: 'name',
      header: 'Household',
      sortable: true,
      cell: (h) => (
        <Link
          href={`/finance/households/${h.id}`}
          className="font-medium text-foreground hover:underline"
        >
          {h.name}
        </Link>
      ),
    },
    {
      id: 'primaryPayer',
      header: 'Primary payer',
      hideable: true,
      cell: (h) => (
        <span className="text-muted-foreground">{primaryPayer(h) ?? '—'}</span>
      ),
    },
    {
      id: 'members',
      header: 'Students',
      align: 'end',
      sortable: true,
      cell: (h) => <span className="tabular-nums">{h.members.length}</span>,
    },
    {
      id: 'payers',
      header: 'Payers',
      align: 'end',
      sortable: true,
      cell: (h) => <span className="tabular-nums">{h.payers.length}</span>,
    },
    {
      id: 'source',
      header: 'Source',
      hideable: true,
      cell: (h) =>
        h.derivedFromGuardianId ? (
          <StatusBadge tone="info">Auto</StatusBadge>
        ) : (
          <StatusBadge tone="neutral">Manual</StatusBadge>
        ),
    },
  ];

  const filtered = React.useMemo(() => {
    const q = term.trim().toLowerCase();
    const source = filters.source;
    let out = households.filter((h) => {
      const matchesQ =
        !q ||
        h.name.toLowerCase().includes(q) ||
        (primaryPayer(h)?.toLowerCase().includes(q) ?? false);
      const matchesSource =
        !source ||
        (source === 'auto'
          ? !!h.derivedFromGuardianId
          : !h.derivedFromGuardianId);
      return matchesQ && matchesSource;
    });
    if (sort) {
      const dir = sort.dir === 'desc' ? -1 : 1;
      out = [...out].sort((a, b) =>
        sort.field === 'members'
          ? dir * (a.members.length - b.members.length)
          : sort.field === 'payers'
            ? dir * (a.payers.length - b.payers.length)
            : dir * a.name.localeCompare(b.name),
      );
    }
    return out;
  }, [households, term, filters, sort]);

  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const hasQuery = term.trim() !== '' || Object.values(filters).some(Boolean);

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

        <DirectoryTable<ApiHousehold>
          title="Family accounts"
          description={`${filtered.length} ${filtered.length === 1 ? 'household' : 'households'}`}
          columns={columns}
          rows={pageRows}
          getRowId={(h) => h.id}
          getRowLabel={(h) => h.name}
          total={filtered.length}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          sort={sort}
          onSortChange={(field) =>
            setSort((cur) =>
              cur?.field !== field
                ? { field, dir: 'asc' }
                : cur.dir === 'asc'
                  ? { field, dir: 'desc' }
                  : null,
            )
          }
          caption="Billing households"
          search={{
            value: term,
            onChange: setTerm,
            placeholder: 'Search household or payer…',
            label: 'Search households',
            id: 'households-search',
          }}
          filters={[
            {
              key: 'source',
              label: 'Source',
              options: [
                { value: 'auto', label: 'Auto' },
                { value: 'manual', label: 'Manual' },
              ],
            },
          ]}
          filterValues={filters}
          onFilterChange={(key, value) =>
            setFilters((f) => ({ ...f, [key]: value }))
          }
          onClearFilters={() => setFilters({})}
          emptyState={
            <EmptyState
              compact
              title={
                hasQuery
                  ? 'No households match your filters'
                  : 'No households yet'
              }
              description={
                hasQuery
                  ? 'Try a different search term, or clear the filters.'
                  : canManage
                    ? 'Auto-derive from guardian relationships, or create one by hand.'
                    : 'No billing households configured.'
              }
            />
          }
        />
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
