'use client';

/* ============================================================
   Adding a line — one entry surface, two shapes

   On a wide screen the entry row is the last row of the lines table: charges
   are typed where charges are shown, and Enter commits and hands the cursor
   back for the next one.

   That does not survive a phone. The table needs ~46rem to hold five columns,
   so at 375px it scrolls sideways and the entry row's quantity, running total
   and Add button all sit off the right edge — you could never see the item you
   picked and the button that commits it at the same time. Below `sm` the same
   entry becomes a stacked card underneath the table instead, where everything
   is visible at once and nothing has to be scrolled to reach.

   One hook drives both, so the two layouts cannot drift into different rules
   about what may be typed or when Add is allowed.
   ============================================================ */

import * as React from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';

import { Button } from '@workspace/ui/components/button';
import { Input } from '@workspace/ui/components/input';
import { Label } from '@workspace/ui/components/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select';
import { TableCell, TableRow } from '@workspace/ui/components/table';

import { formatNaira as naira, koboFromNaira } from '@/lib/format';
import { MIN_QUANTITY } from '@/lib/invoice-lines';
import { QuantityField } from './quantity-field';

export interface LineEntryValue {
  feeItemId: string;
  /** Kobo. For a fixed item this is the catalogue price, not what was typed. */
  amount: number;
  quantity: number;
  description?: string;
}

export interface EntryCatalogueItem {
  id: string;
  code: string;
  name: string;
  pricingMode: 'fixed' | 'open';
  defaultAmount: number | null;
}

export function useLineEntry({
  catalogue,
  onAdd,
}: {
  catalogue: EntryCatalogueItem[];
  onAdd: (value: LineEntryValue, item: EntryCatalogueItem) => void;
}) {
  const [feeItemId, setFeeItemId] = React.useState('');
  const [amount, setAmount] = React.useState('');
  const [quantity, setQuantity] = React.useState(MIN_QUANTITY);
  const [description, setDescription] = React.useState('');
  const itemRef = React.useRef<HTMLButtonElement>(null);

  const picked = catalogue.find((c) => c.id === feeItemId);
  // A till does not let you type a price for stock: a fixed item carries its
  // price on the item record, and only an open-priced item is priced here. The
  // server enforces this too, so a crafted request cannot discount tuition.
  const openPriced = picked?.pricingMode === 'open';

  const pickItem = (id: string) => {
    setFeeItemId(id);
    const item = catalogue.find((c) => c.id === id);
    setAmount(
      item && item.pricingMode !== 'open' && item.defaultAmount != null
        ? String(item.defaultAmount / 100)
        : '',
    );
  };

  const amountKobo = openPriced
    ? koboFromNaira(amount)
    : (picked?.defaultAmount ?? null);
  const canAdd = picked != null && amountKobo != null && amountKobo > 0;
  const lineTotal =
    amountKobo != null ? naira(amountKobo * quantity) : '—';

  const submit = () => {
    if (!canAdd || amountKobo == null || picked == null) return;
    onAdd(
      {
        feeItemId,
        amount: amountKobo,
        quantity,
        description: description.trim() || undefined,
      },
      picked,
    );
    setFeeItemId('');
    setAmount('');
    setQuantity(MIN_QUANTITY);
    setDescription('');
    itemRef.current?.focus();
  };

  return {
    feeItemId,
    picked,
    openPriced,
    pickItem,
    amount,
    setAmount,
    quantity,
    setQuantity,
    description,
    setDescription,
    amountKobo,
    lineTotal,
    canAdd,
    submit,
    itemRef,
  };
}

export type LineEntry = ReturnType<typeof useLineEntry>;

/** The catalogue picker, shared by both layouts. */
function ItemSelect({
  entry,
  catalogue,
  className,
}: {
  entry: LineEntry;
  catalogue: EntryCatalogueItem[];
  className?: string;
}) {
  return (
    <Select value={entry.feeItemId} onValueChange={entry.pickItem}>
      <SelectTrigger ref={entry.itemRef} aria-label="Fee item" className={className}>
        <SelectValue placeholder="Add a fee item…" />
      </SelectTrigger>
      <SelectContent>
        {catalogue.map((c) => {
          // A fixed item with no price is a configuration error, not a free
          // bill — the server refuses it, so don't offer it.
          const unpriced = c.pricingMode !== 'open' && c.defaultAmount == null;
          return (
            <SelectItem key={c.id} value={c.id} disabled={unpriced}>
              <span className="flex w-full items-center justify-between gap-4">
                <span>{c.name}</span>
                <span className="tabular-nums text-muted-foreground">
                  {unpriced
                    ? 'set a price'
                    : c.pricingMode === 'open'
                      ? 'per line'
                      : naira(c.defaultAmount ?? 0)}
                </span>
              </span>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

/** Shown when there is nothing to bill for yet. */
function EmptyCatalogueNote() {
  return (
    <>
      The fee-item catalogue is empty — add items on the{' '}
      <Link href="/finance/fee-items" className="underline underline-offset-2">
        fee items
      </Link>{' '}
      page to bill for them.
    </>
  );
}

/**
 * The wide-screen entry row. Hidden below `sm`, where the table is too narrow
 * to hold it and `LineEntryCard` takes over.
 */
export function LineEntryRow({
  entry,
  catalogue,
}: {
  entry: LineEntry;
  catalogue: EntryCatalogueItem[];
}) {
  if (catalogue.length === 0) {
    return (
      <TableRow className="hidden bg-muted/30 sm:table-row">
        <TableCell colSpan={5} className="text-muted-foreground">
          <EmptyCatalogueNote />
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow
      className="hidden bg-muted/30 hover:bg-muted/40 sm:table-row"
      // Enter commits, but only from a text field: the select's own Enter is
      // how an item gets chosen, and must not also add the line.
      onKeyDown={(e) => {
        if (e.key !== 'Enter') return;
        if ((e.target as HTMLElement).tagName !== 'INPUT') return;
        e.preventDefault();
        entry.submit();
      }}
    >
      <TableCell>
        <div className="flex flex-col gap-1.5">
          <ItemSelect entry={entry} catalogue={catalogue} className="h-8" />
          <Input
            value={entry.description}
            onChange={(e) => entry.setDescription(e.target.value)}
            aria-label="Line description"
            placeholder="Note (optional)"
            autoComplete="off"
            disabled={!entry.picked}
            className="h-7 text-xs"
          />
        </div>
      </TableCell>
      <TableCell className="align-top text-right">
        {entry.picked && !entry.openPriced ? (
          <span className="ml-auto inline-flex h-8 w-28 items-center justify-end tabular-nums text-muted-foreground">
            {entry.picked.defaultAmount != null
              ? naira(entry.picked.defaultAmount)
              : '—'}
          </span>
        ) : (
          <Input
            value={entry.amount}
            onChange={(e) => entry.setAmount(e.target.value)}
            aria-label="Unit amount in naira"
            inputMode="decimal"
            placeholder="0.00"
            autoComplete="off"
            disabled={!entry.picked}
            className="ml-auto h-8 w-28 text-right tabular-nums"
          />
        )}
      </TableCell>
      <TableCell className="align-top text-right">
        <QuantityField
          value={entry.quantity}
          onChange={entry.setQuantity}
          disabled={!entry.picked}
        />
      </TableCell>
      <TableCell className="align-top text-right font-medium leading-8 tabular-nums">
        {entry.lineTotal}
      </TableCell>
      <TableCell className="align-top text-right">
        <Button size="sm" disabled={!entry.canAdd} onClick={entry.submit}>
          <Plus aria-hidden /> Add
        </Button>
      </TableCell>
    </TableRow>
  );
}

/**
 * The same entry, stacked, for screens the table cannot fit on.
 *
 * Rendered OUTSIDE the table so it is not bound by the table's minimum width —
 * inside it, a full-width cell would still be ~46rem and scroll off just like
 * the row it replaces.
 */
export function LineEntryCard({
  entry,
  catalogue,
}: {
  entry: LineEntry;
  catalogue: EntryCatalogueItem[];
}) {
  if (catalogue.length === 0) {
    return (
      <div className="border-t border-border px-4 py-4 text-sm text-muted-foreground sm:hidden">
        <EmptyCatalogueNote />
      </div>
    );
  }

  return (
    <div
      className="flex flex-col gap-3 border-t border-border bg-muted/30 px-4 py-4 sm:hidden"
      onKeyDown={(e) => {
        if (e.key !== 'Enter') return;
        if ((e.target as HTMLElement).tagName !== 'INPUT') return;
        e.preventDefault();
        entry.submit();
      }}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="entry-item-m">Add a line</Label>
        <ItemSelect entry={entry} catalogue={catalogue} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="entry-amount-m">Unit amount (₦)</Label>
          {entry.picked && !entry.openPriced ? (
            <span className="flex h-9 items-center tabular-nums text-muted-foreground">
              {entry.picked.defaultAmount != null
                ? naira(entry.picked.defaultAmount)
                : '—'}
            </span>
          ) : (
            <Input
              id="entry-amount-m"
              value={entry.amount}
              onChange={(e) => entry.setAmount(e.target.value)}
              aria-label="Unit amount in naira"
              inputMode="decimal"
              placeholder="0.00"
              autoComplete="off"
              disabled={!entry.picked}
              className="tabular-nums"
            />
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="entry-qty-m">Quantity</Label>
          <QuantityField
            value={entry.quantity}
            onChange={entry.setQuantity}
            disabled={!entry.picked}
            className="justify-start"
          />
        </div>
      </div>

      <Input
        value={entry.description}
        onChange={(e) => entry.setDescription(e.target.value)}
        aria-label="Line description"
        placeholder="Note (optional)"
        autoComplete="off"
        disabled={!entry.picked}
      />

      {/* The running total sits with the button that commits it — the whole
          reason the row layout fails on a phone is that these two ended up on
          opposite sides of a scroll. */}
      <div className="flex items-center justify-between gap-3">
        <span className="text-[calc(12.5px*var(--font-scale))] text-muted-foreground">
          Line total{' '}
          <span className="font-medium tabular-nums text-foreground">
            {entry.lineTotal}
          </span>
        </span>
        <Button size="sm" disabled={!entry.canAdd} onClick={entry.submit}>
          <Plus aria-hidden /> Add
        </Button>
      </div>
    </div>
  );
}
