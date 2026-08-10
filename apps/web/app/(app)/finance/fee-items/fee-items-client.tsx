'use client';

/* ============================================================
   FeeItemsClient — the tenant's fee-item catalogue

   A small managed set (Tuition, Boarding, Bus, PTA levy, …) that invoice lines
   and discount policies reference by id. Add / edit / archive here; the code is
   the stable slug and is immutable once created. Management actions are gated on
   `finance.manage` server-side (`canManage` only decides whether the controls
   render). Amounts are kobo (minor units) end to end.
   ============================================================ */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Pencil, Plus } from 'lucide-react';

import { Button } from '@workspace/ui/components/button';
import { Input } from '@workspace/ui/components/input';
import { Label } from '@workspace/ui/components/label';
import { Checkbox } from '@workspace/ui/components/checkbox';
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
import { formatNaira as nairaFromKobo } from '@/lib/format';
import { DEFAULT_PAGE_SIZE } from '@/lib/page-size';

export interface FeeItem {
  id: string;
  code: string;
  name: string;
  /** Suggested amount in kobo, or null when the item has no default. */
  defaultAmount: number | null;
  active: boolean;
}

/** Parse a ₦ amount (naira, optional decimals) into kobo; null when blank. */
function koboFromNaira(input: string): number | null {
  const trimmed = input.trim();
  if (trimmed === '') return null;
  const naira = Number(trimmed.replace(/,/g, ''));
  if (!Number.isFinite(naira) || naira < 0) return null;
  return Math.round(naira * 100);
}

function nairaInputValue(kobo: number | null): string {
  return kobo == null ? '' : String(kobo / 100);
}

interface Props {
  items: FeeItem[];
  canManage: boolean;
}

export function FeeItemsClient({ items, canManage }: Props) {
  const [term, setTerm] = React.useState('');
  const [filters, setFilters] = React.useState<
    Record<string, string | null | undefined>
  >({});
  const [sort, setSort] = React.useState<DirectorySort | null>(null);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(DEFAULT_PAGE_SIZE);

  React.useEffect(() => setPage(1), [term, filters, pageSize]);

  const columns: DirectoryColumn<FeeItem>[] = [
    {
      id: 'name',
      header: 'Item',
      sortable: true,
      cell: (i) => (
        <span className="font-medium text-foreground">{i.name}</span>
      ),
    },
    {
      id: 'code',
      header: 'Code',
      sortable: true,
      hideable: true,
      cell: (i) => (
        <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
          {i.code}
        </code>
      ),
    },
    {
      id: 'defaultAmount',
      header: 'Default amount',
      align: 'end',
      sortable: true,
      cell: (i) => (
        <span className="tabular-nums">{nairaFromKobo(i.defaultAmount)}</span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      sortable: true,
      cell: (i) =>
        i.active ? (
          <StatusBadge tone="success" dot>
            Active
          </StatusBadge>
        ) : (
          <StatusBadge tone="neutral">Archived</StatusBadge>
        ),
    },
    ...(canManage
      ? ([
          {
            id: 'actions',
            header: 'Actions',
            align: 'end',
            cell: (i: FeeItem) => <EditFeeItemDialog item={i} />,
          },
        ] as DirectoryColumn<FeeItem>[])
      : []),
  ];

  const filtered = React.useMemo(() => {
    const q = term.trim().toLowerCase();
    const status = filters.status;
    let out = items.filter((i) => {
      const matchesQ =
        !q ||
        i.name.toLowerCase().includes(q) ||
        i.code.toLowerCase().includes(q);
      const matchesStatus =
        !status || (status === 'active' ? i.active : !i.active);
      return matchesQ && matchesStatus;
    });
    if (sort) {
      const dir = sort.dir === 'desc' ? -1 : 1;
      out = [...out].sort((a, b) =>
        sort.field === 'defaultAmount'
          ? dir * ((a.defaultAmount ?? -1) - (b.defaultAmount ?? -1))
          : sort.field === 'code'
            ? dir * a.code.localeCompare(b.code)
            : sort.field === 'status'
              ? dir * (Number(a.active) - Number(b.active))
              : dir * a.name.localeCompare(b.name),
      );
    }
    return out;
  }, [items, term, filters, sort]);

  const activeCount = items.filter((i) => i.active).length;
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const hasQuery = term.trim() !== '' || Object.values(filters).some(Boolean);

  return (
    <ShellMain>
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Fee items"
          actions={canManage ? <AddFeeItemDialog /> : undefined}
        />

        <DirectoryTable<FeeItem>
          title="Catalogue"
          description={`${filtered.length} ${filtered.length === 1 ? 'item' : 'items'} · ${activeCount} active`}
          columns={columns}
          rows={pageRows}
          getRowId={(i) => i.id}
          getRowLabel={(i) => i.name}
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
          caption="Fee-item catalogue"
          search={{
            value: term,
            onChange: setTerm,
            placeholder: 'Search item or code…',
            label: 'Search fee items',
            id: 'fee-items-search',
          }}
          filters={[
            {
              key: 'status',
              label: 'Status',
              options: [
                { value: 'active', label: 'Active' },
                { value: 'archived', label: 'Archived' },
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
                  ? 'No fee items match your filters'
                  : 'No fee items yet'
              }
              description={
                hasQuery
                  ? 'Try a different search term, or clear the filters.'
                  : canManage
                    ? 'Add your first fee item, or run the operational seed to load the standard catalogue.'
                    : 'The fee-item catalogue is empty.'
              }
            />
          }
        />
      </div>
    </ShellMain>
  );
}

/* ---- Dialogs ------------------------------------------------------------ */

function AddFeeItemDialog() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [code, setCode] = React.useState('');
  const [name, setName] = React.useState('');
  const [amount, setAmount] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setCode('');
      setName('');
      setAmount('');
    }
  }, [open]);

  const codeValid = /^[a-z0-9_]+$/.test(code);
  const canSubmit = codeValid && name.trim() !== '' && !busy;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus aria-hidden /> Add fee item
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a fee item</DialogTitle>
          <DialogDescription>
            The code is a stable slug (lowercase, digits, underscore) — it is
            referenced by invoice lines and policies and cannot change later.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fi-code">Code</Label>
            <Input
              id="fi-code"
              value={code}
              onChange={(e) =>
                setCode(e.target.value.toLowerCase().replace(/\s+/g, '_'))
              }
              placeholder="boarding"
              autoComplete="off"
            />
            {code !== '' && !codeValid ? (
              <p className="text-xs text-destructive">
                Only lowercase letters, digits and underscores.
              </p>
            ) : null}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fi-name">Name</Label>
            <Input
              id="fi-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Boarding"
              autoComplete="off"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fi-amount">
              Default amount{' '}
              <span className="text-muted-foreground">(₦, optional)</span>
            </Label>
            <Input
              id="fi-amount"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="150000"
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
            disabled={!canSubmit}
            onClick={async () => {
              setBusy(true);
              try {
                const res = await authedFetch('/api/finance/fee-items', {
                  method: 'POST',
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify({
                    code,
                    name: name.trim(),
                    defaultAmount: koboFromNaira(amount) ?? undefined,
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
                toast.success('Fee item added');
                setOpen(false);
                router.refresh();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : 'Add failed');
              } finally {
                setBusy(false);
              }
            }}
          >
            Add fee item
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditFeeItemDialog({ item }: { item: FeeItem }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState(item.name);
  const [amount, setAmount] = React.useState(
    nairaInputValue(item.defaultAmount),
  );
  const [active, setActive] = React.useState(item.active);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setName(item.name);
      setAmount(nairaInputValue(item.defaultAmount));
      setActive(item.active);
    }
  }, [open, item]);

  const canSubmit = name.trim() !== '' && !busy;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Pencil aria-hidden /> Edit
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit fee item</DialogTitle>
          <DialogDescription>
            <code className="text-xs">{item.code}</code> — the code is fixed;
            you can rename it, change its default, or archive it.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fi-edit-name">Name</Label>
            <Input
              id="fi-edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fi-edit-amount">
              Default amount{' '}
              <span className="text-muted-foreground">(₦, optional)</span>
            </Label>
            <Input
              id="fi-edit-amount"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="150000"
              autoComplete="off"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={active}
              onCheckedChange={(v) => setActive(Boolean(v))}
            />
            Active (available for new invoice lines)
          </label>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" size="sm">
              Cancel
            </Button>
          </DialogClose>
          <Button
            size="sm"
            disabled={!canSubmit}
            onClick={async () => {
              setBusy(true);
              try {
                const res = await authedFetch(
                  `/api/finance/fee-items/${item.id}`,
                  {
                    method: 'PATCH',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({
                      name: name.trim(),
                      defaultAmount: koboFromNaira(amount),
                      active,
                    }),
                  },
                );
                if (!res.ok) {
                  const d = (await res.json().catch(() => null)) as {
                    message?: string;
                  } | null;
                  throw new Error(
                    d?.message ?? `Request failed (${res.status})`,
                  );
                }
                toast.success('Fee item updated');
                setOpen(false);
                router.refresh();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : 'Update failed');
              } finally {
                setBusy(false);
              }
            }}
          >
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
