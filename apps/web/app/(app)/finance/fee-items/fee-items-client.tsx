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

import {
  Sheet,
  SheetClose,
  SheetDescription,
} from '@workspace/ui/components/sheet';
import {
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@workspace/ui/custom/detail/drawer-chrome';
import { Button } from '@workspace/ui/components/button';
import { Input } from '@workspace/ui/components/input';
import { Label } from '@workspace/ui/components/label';
import { Checkbox } from '@workspace/ui/components/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select';
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
import { formatNaira as nairaFromKobo, koboFromNaira } from '@/lib/format';
import { DEFAULT_PAGE_SIZE } from '@/lib/page-size';

export type FeePricingMode = 'fixed' | 'open';

export interface FeeItem {
  id: string;
  code: string;
  name: string;
  /**
   * 'fixed' — the price lives here and an invoice line is billed at it,
   *           read-only. The item cannot be billed until it has one.
   * 'open'  — priced per line at entry (damages, miscellaneous), so this item
   *           deliberately carries no price of its own.
   */
  pricingMode: FeePricingMode;
  /** Price in kobo. Required for a fixed item; unused by an open one. */
  defaultAmount: number | null;
  active: boolean;
}

/**
 * The two ways a fee can be priced, and why a school would pick each.
 *
 * Worded as consequences rather than jargon: a bursar choosing between these
 * cares what happens on the invoice, not what the column is called.
 */
const PRICING_MODES: ReadonlyArray<{
  value: FeePricingMode;
  label: string;
  hint: string;
}> = [
  {
    value: 'fixed',
    label: 'Fixed price',
    hint: 'Billed at the price set here. Nobody can change it while adding a line.',
  },
  {
    value: 'open',
    label: 'Priced per invoice',
    hint: 'The amount is typed on each line — for damages, replacements and one-offs.',
  },
];

/**
 * How this item is priced, and the price itself.
 *
 * The two belong together: an open-priced item has no price of its own, so
 * showing an amount field beside it would be asking for a number that is
 * ignored. Picking "Priced per invoice" therefore hides the amount rather than
 * disabling it — there is nothing to fill in, not something withheld.
 */
function PricingFields({
  idPrefix,
  mode,
  onModeChange,
  amount,
  onAmountChange,
}: {
  idPrefix: string;
  mode: FeePricingMode;
  onModeChange: (next: FeePricingMode) => void;
  amount: string;
  onAmountChange: (next: string) => void;
}) {
  const meta = PRICING_MODES.find((m) => m.value === mode);
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-pricing`}>Pricing</Label>
        <Select
          value={mode}
          onValueChange={(next) => onModeChange(next as FeePricingMode)}
        >
          <SelectTrigger id={`${idPrefix}-pricing`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PRICING_MODES.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {meta ? (
          <p className="text-xs text-muted-foreground">{meta.hint}</p>
        ) : null}
      </div>

      {mode === 'fixed' ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}-amount`}>
            Price <span className="text-muted-foreground">(₦)</span>
          </Label>
          <Input
            id={`${idPrefix}-amount`}
            inputMode="decimal"
            value={amount}
            onChange={(e) => onAmountChange(e.target.value)}
            placeholder="150000"
            autoComplete="off"
          />
          {amount.trim() === '' ? (
            // Not a validation error — the item saves fine. It simply cannot
            // be put on an invoice until it has a price, and finding that out
            // here beats finding it out mid-invoice.
            <p className="text-xs text-muted-foreground">
              Set a price before this item can be added to an invoice.
            </p>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

/** Parse a ₦ amount (naira, optional decimals) into kobo; null when blank. */
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
      header: 'Price',
      align: 'end',
      sortable: true,
      cell: (i) => {
        if (i.pricingMode === 'open') {
          return (
            <span className="text-muted-foreground">Per invoice</span>
          );
        }
        // A fixed item with no price cannot be billed, and that is worth
        // saying here rather than leaving a bursar to discover it mid-invoice.
        if (i.defaultAmount == null) {
          return <StatusBadge tone="warning">Needs a price</StatusBadge>;
        }
        return (
          <span className="tabular-nums">{nairaFromKobo(i.defaultAmount)}</span>
        );
      },
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
  const [pricingMode, setPricingMode] =
    React.useState<FeePricingMode>('fixed');
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
    <Sheet open={open} onOpenChange={setOpen}>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus aria-hidden /> Add fee item
      </Button>
      <DrawerContent>
        <DrawerHeader className="gap-1.5">
          <DrawerTitle className="pr-8">Add a fee item</DrawerTitle>
          <SheetDescription className="text-[calc(12.5px*var(--font-scale))]">
            The code is a stable slug (lowercase, digits, underscore) — it is
            referenced by invoice lines and policies and cannot change later.
          </SheetDescription>
        </DrawerHeader>
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-5">
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
            <PricingFields
              idPrefix="fi"
              mode={pricingMode}
              onModeChange={setPricingMode}
              amount={amount}
              onAmountChange={setAmount}
            />
          </div>
        </div>
        <DrawerFooter className="flex-row justify-end gap-2">
          <SheetClose asChild>
            <Button variant="ghost" size="sm">
              Cancel
            </Button>
          </SheetClose>
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
                    pricingMode,
                    // An open item is priced on the line, so it never carries
                    // one of its own — don't send a stale number.
                    defaultAmount:
                      pricingMode === 'open'
                        ? undefined
                        : (koboFromNaira(amount) ?? undefined),
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
        </DrawerFooter>
      </DrawerContent>
    </Sheet>
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
  const [pricingMode, setPricingMode] = React.useState<FeePricingMode>(
    item.pricingMode,
  );
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setName(item.name);
      setAmount(nairaInputValue(item.defaultAmount));
      setActive(item.active);
      setPricingMode(item.pricingMode);
    }
  }, [open, item]);

  const canSubmit = name.trim() !== '' && !busy;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Pencil aria-hidden /> Edit
      </Button>
      <DrawerContent>
        <DrawerHeader className="gap-1.5">
          <DrawerTitle className="pr-8">Edit fee item</DrawerTitle>
          <SheetDescription className="text-[calc(12.5px*var(--font-scale))]">
            <code className="text-xs">{item.code}</code> — the code is fixed;
            you can rename it, change its default, or archive it.
          </SheetDescription>
        </DrawerHeader>
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-5">
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
            <PricingFields
              idPrefix="fi-edit"
              mode={pricingMode}
              onModeChange={setPricingMode}
              amount={amount}
              onAmountChange={setAmount}
            />
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={active}
                onCheckedChange={(v) => setActive(Boolean(v))}
              />
              Active (available for new invoice lines)
            </label>
          </div>
        </div>
        <DrawerFooter className="flex-row justify-end gap-2">
          <SheetClose asChild>
            <Button variant="ghost" size="sm">
              Cancel
            </Button>
          </SheetClose>
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
                      pricingMode,
                      // Switching an item to open pricing clears the price it
                      // used to carry, so nothing stale is left to bill at.
                      defaultAmount:
                        pricingMode === 'open' ? null : koboFromNaira(amount),
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
        </DrawerFooter>
      </DrawerContent>
    </Sheet>
  );
}
