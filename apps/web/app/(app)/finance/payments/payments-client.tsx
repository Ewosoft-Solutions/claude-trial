'use client';

/* ============================================================
   PaymentsClient — receipts (server-driven table + family checkout)

   A receipt is money received from a payer; the allocations underneath say
   which child's bill each naira settled. The table lists them; the row drawer
   shows the breakdown and records a reprint; "Record payment" opens the family
   checkout — pick a family, see everything it owes, allocate.
   ============================================================ */

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Printer, Wallet } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@workspace/ui/components/button';
import { Input } from '@workspace/ui/components/input';
import { Label } from '@workspace/ui/components/label';
import { Checkbox } from '@workspace/ui/components/checkbox';
import { Sheet, SheetDescription } from '@workspace/ui/components/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select';
import { PageHeader } from '@workspace/ui/custom/shell/page-header';
import { ShellMain } from '@workspace/ui/custom/shell/app-shell';
import { StatGrid } from '@workspace/ui/custom/layouts/stat-grid';
import {
  EmptyState,
  ErrorState,
} from '@workspace/ui/custom/states/page-states';
import { StatusBadge } from '@workspace/ui/custom/data-display/status-badge';
import {
  DetailGrid,
  Field,
  Section,
} from '@workspace/ui/custom/detail/detail-primitives';
import {
  DirectoryTable,
  type DirectoryColumn,
} from '@workspace/ui/custom/tables/directory-table';
import { useDirectoryState } from '@workspace/ui/hooks/use-directory-state';
import type { StateTone } from '@workspace/ui/types/states.types';
import type { StatItem } from '@workspace/ui/types/layout.types';
import {
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@workspace/ui/custom/detail/drawer-chrome';

import { authedFetch } from '@/lib/authed-fetch';
import { formatNaira as nairaFromKobo } from '@/lib/format';
import { STEP_UP_OPERATION } from '@/lib/step-up';
import { useStepUpAction } from '../../_shared/use-step-up-action';
import { Dot } from '@workspace/ui/custom/data-display/dot';

export type PaymentMethod = 'transfer' | 'card' | 'cash' | 'cheque';
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';

export interface Receipt {
  id: string;
  receiptNumber: string;
  payerName?: string;
  householdName?: string;
  method: PaymentMethod;
  date?: string;
  /** Amounts in kobo (minor units). */
  amount: number;
  allocated: number;
  unallocated: number;
  covers: string[];
  reference?: string;
  status: PaymentStatus;
}

export interface HouseholdOption {
  id: string;
  name: string;
  payerName?: string;
}

interface CollectionSummary {
  label: string;
  received: number;
  count: number;
  unallocated: number;
}

const METHOD_LABEL: Record<PaymentMethod, string> = {
  transfer: 'Bank transfer',
  card: 'Card',
  cash: 'Cash',
  cheque: 'Cheque',
};

const STATUS_META: Record<PaymentStatus, { label: string; tone: StateTone }> = {
  completed: { label: 'Completed', tone: 'success' },
  pending: { label: 'Pending', tone: 'warning' },
  failed: { label: 'Failed', tone: 'destructive' },
  refunded: { label: 'Refunded', tone: 'neutral' },
};

interface Props {
  receipts: Receipt[];
  total: number;
  defaultPageSize: number;
  households: HouseholdOption[];
  canManage: boolean;
  collections: CollectionSummary;
}

export function PaymentsClient({
  receipts,
  total,
  defaultPageSize,
  households,
  canManage,
  collections,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [openReceiptId, setOpenReceiptId] = React.useState<string | null>(null);

  const onChange = React.useCallback(
    (qs: string) => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname],
  );

  const defaults = React.useMemo(
    () => ({ pageSize: defaultPageSize }),
    [defaultPageSize],
  );
  const {
    state,
    setPage,
    setPageSize,
    setQuery,
    setFilter,
    setFilters,
    toggleSort,
  } = useDirectoryState({
    searchParams: searchParams.toString(),
    onChange,
    defaults,
  });

  const [term, setTerm] = React.useState(state.q);
  React.useEffect(() => setTerm(state.q), [state.q]);
  React.useEffect(() => {
    if (term === state.q) return;
    const id = setTimeout(() => setQuery(term), 300);
    return () => clearTimeout(id);
  }, [term, state.q, setQuery]);

  const hasFilters =
    state.q.trim() !== '' ||
    Object.values(state.filters).some((value) => value && value !== 'all');

  const statItems: StatItem[] = [
    {
      key: 'received',
      label: `Received — ${collections.label}`,
      value: nairaFromKobo(collections.received),
    },
    {
      key: 'count',
      label: 'Receipts issued',
      value: String(collections.count),
    },
    {
      key: 'unallocated',
      // Not the credit balance held today — that is drawn down as invoices are
      // issued. This is what these receipts did not settle when they arrived.
      label: 'Received unallocated',
      value: nairaFromKobo(collections.unallocated),
    },
  ];

  const columns: DirectoryColumn<Receipt>[] = [
    {
      id: 'receiptNumber',
      header: 'Receipt',
      cell: (receipt) => (
        <div className="flex min-w-0 flex-col">
          <span className="break-words font-medium text-foreground">
            {receipt.payerName ?? 'Unnamed payer'}
          </span>
          <span className="break-words text-xs text-muted-foreground">
            {receipt.receiptNumber}
          </span>
        </div>
      ),
    },
    {
      id: 'covers',
      header: 'Settles',
      hideable: true,
      cell: (receipt) =>
        receipt.covers.length ? (
          <span className="text-muted-foreground">
            {receipt.covers.join(', ')}
          </span>
        ) : (
          <span className="text-muted-foreground">
            Held as credit — nothing settled
          </span>
        ),
    },
    {
      id: 'paidAt',
      header: 'Received',
      cell: (receipt) => (
        <span className="text-muted-foreground">{receipt.date ?? '—'}</span>
      ),
    },
    {
      id: 'method',
      header: 'Method',
      hideable: true,
      cell: (receipt) => (
        <span className="text-muted-foreground">
          {METHOD_LABEL[receipt.method] ?? receipt.method}
        </span>
      ),
    },
    {
      id: 'amount',
      header: 'Amount',
      align: 'end',
      cell: (receipt) => (
        <div className="flex flex-col items-end">
          <span className="tabular-nums font-medium text-foreground">
            {nairaFromKobo(receipt.amount)}
          </span>
          {receipt.unallocated > 0 ? (
            <span className="tabular-nums text-xs text-muted-foreground">
              {nairaFromKobo(receipt.unallocated)} unallocated
            </span>
          ) : null}
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (receipt) => {
        const meta = STATUS_META[receipt.status] ?? STATUS_META.pending;
        return (
          <StatusBadge tone={meta.tone} dot>
            {meta.label}
          </StatusBadge>
        );
      },
    },
  ];

  return (
    <ShellMain>
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Payments"
          actions={
            canManage ? (
              <RecordPaymentDrawer
                households={households}
                onRecorded={() => router.refresh()}
              />
            ) : null
          }
        />

        <StatGrid items={statItems} />

        <DirectoryTable<Receipt>
          columns={columns}
          rows={receipts}
          getRowId={(receipt) => receipt.id}
          getRowLabel={(receipt) => receipt.receiptNumber}
          onRowClick={(receipt) => setOpenReceiptId(receipt.id)}
          total={total}
          page={state.page}
          pageSize={state.pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          sort={state.sort}
          onSortChange={toggleSort}
          title="Receipts"
          description={`${total} ${total === 1 ? 'receipt' : 'receipts'}`}
          caption="Payment receipts"
          search={{
            value: term,
            onChange: setTerm,
            placeholder: 'Search receipt #, payer or reference…',
            label: 'Search receipts',
            id: 'receipt-search',
          }}
          filters={[
            {
              key: 'method',
              label: 'Method',
              options: [
                { value: 'transfer', label: 'Bank transfer' },
                { value: 'cash', label: 'Cash' },
                { value: 'card', label: 'Card' },
                { value: 'cheque', label: 'Cheque' },
              ],
            },
            {
              key: 'status',
              label: 'Status',
              options: [
                { value: 'completed', label: 'Completed' },
                { value: 'pending', label: 'Pending' },
                { value: 'refunded', label: 'Refunded' },
              ],
            },
          ]}
          filterValues={state.filters}
          onFilterChange={setFilter}
          onClearFilters={() => setFilters({})}
          emptyState={
            <EmptyState
              compact
              title={
                hasFilters
                  ? 'No receipts match your filters'
                  : 'No receipts yet'
              }
              description={
                hasFilters
                  ? 'Try a different search term, or clear the filters to see every receipt.'
                  : 'Record a payment to raise the first receipt.'
              }
            />
          }
        />
      </div>

      <ReceiptDrawer
        receiptId={openReceiptId}
        onClose={() => setOpenReceiptId(null)}
      />
    </ShellMain>
  );
}

/* ---- Receipt drawer ----------------------------------------------------- */

interface ReceiptDetail {
  id: string;
  receiptNumber: string;
  payerName?: string | null;
  method: PaymentMethod;
  paidAt: string;
  amount: number;
  reference?: string | null;
  notes?: string | null;
  status: PaymentStatus;
  reprintCount?: number;
  allocatedAmount?: number;
  unallocatedAmount?: number;
  household?: { id: string; name: string } | null;
  allocations?: Array<{
    id: string;
    amount: number;
    invoice?: {
      id: string;
      invoiceNumber?: string | null;
      studentName?: string | null;
      termName?: string | null;
    } | null;
  }>;
  credits?: Array<{ id: string; amount: number; remaining: number }>;
}

function ReceiptDrawer({
  receiptId,
  onClose,
}: {
  receiptId: string | null;
  onClose: () => void;
}) {
  const [receipt, setReceipt] = React.useState<ReceiptDetail | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!receiptId) {
      setReceipt(null);
      setError(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await authedFetch(`/api/finance/receipts/${receiptId}`);
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        const data = (await res.json()) as ReceiptDetail;
        if (!cancelled) {
          setReceipt(data);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : 'Could not load the receipt',
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [receiptId]);

  const reprint = async () => {
    if (!receiptId) return;
    setBusy(true);
    try {
      const res = await authedFetch(
        `/api/finance/receipts/${receiptId}/reprint`,
        { method: 'POST' },
      );
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const data = (await res.json()) as ReceiptDetail;
      setReceipt(data);
      toast.success(
        'Reprint recorded — the copy is logged against this receipt',
      );
      window.print();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : 'Could not record the reprint',
      );
    } finally {
      setBusy(false);
    }
  };

  const allocations = receipt?.allocations ?? [];

  return (
    <Sheet open={!!receiptId} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{receipt?.receiptNumber ?? 'Receipt'}</DrawerTitle>
          <SheetDescription>
            {receipt?.payerName
              ? `Received from ${receipt.payerName}`
              : 'Money received and what it settled'}
          </SheetDescription>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {error ? (
            <ErrorState
              compact
              title="Could not load the receipt"
              description={error}
            />
          ) : !receipt ? (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading…
            </div>
          ) : (
            <div className="flex flex-col gap-5 py-2">
              <Section title="Payment">
                <DetailGrid>
                  <Field label="Amount" value={nairaFromKobo(receipt.amount)} />
                  <Field
                    label="Method"
                    value={METHOD_LABEL[receipt.method] ?? receipt.method}
                  />
                  <Field
                    label="Received"
                    value={new Date(receipt.paidAt).toLocaleDateString('en-GB')}
                  />
                  <Field label="Reference" value={receipt.reference ?? '—'} />
                  <Field
                    label="Family"
                    value={receipt.household?.name ?? '—'}
                  />
                  <Field
                    label="Reprints"
                    value={String(receipt.reprintCount ?? 0)}
                  />
                </DetailGrid>
              </Section>

              <Section title="What it settled">
                {allocations.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nothing was settled by this receipt — the whole amount is
                    held as credit against future invoices.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {allocations.map((allocation) => (
                      <li
                        key={allocation.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card/40 p-2.5"
                      >
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate text-sm font-medium text-foreground">
                            {allocation.invoice?.studentName ??
                              'Unnamed student'}
                          </span>
                          <Link
                            href={`/finance/invoices/${allocation.invoice?.id ?? ''}`}
                            className="truncate text-xs text-muted-foreground hover:underline"
                          >
                            {allocation.invoice?.invoiceNumber ?? 'Invoice'}
                          </Link>
                        </div>
                        <span className="tabular-nums text-sm text-foreground">
                          {nairaFromKobo(allocation.amount)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              {receipt.unallocatedAmount ? (
                <Section title="Unallocated at the time">
                  <p className="text-sm text-muted-foreground">
                    {nairaFromKobo(receipt.unallocatedAmount)} of this receipt
                    settled nothing when it was taken, and became credit on the
                    family account. It may since have been drawn down — the
                    family&apos;s current credit is on their household page.
                  </p>
                </Section>
              ) : null}
            </div>
          )}
        </div>

        <DrawerFooter className="flex-row justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
          <Button size="sm" onClick={reprint} disabled={!receipt || busy}>
            {busy ? <Loader2 className="animate-spin" /> : <Printer />} Reprint
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Sheet>
  );
}

/* ---- Family checkout ---------------------------------------------------- */

interface OutstandingInvoice {
  id: string;
  invoiceNumber: string;
  studentName?: string | null;
  termName?: string | null;
  dueDate?: string | null;
  financials: { balance: number };
}

interface OutstandingResponse {
  household: { id: string; name: string; primaryPayerName?: string | null };
  invoices: OutstandingInvoice[];
  totalOutstanding: number;
  availableCredit: number;
}

/**
 * Naira (major units, as typed) → kobo, or null when what was typed is not a
 * plain positive amount.
 *
 * Silently coercing is how a typo becomes a receipt: stripping the sign turned
 * `-500` into ₦500, a pasted `1.234,50` became ₦1.23, and `12.34.56` became 0.
 * Returning null instead lets the caller refuse to submit and say why.
 */
function toKobo(value: string): number | null {
  const trimmed = value.trim().replace(/[\s,₦]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const amount = Number(trimmed);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(amount * 100);
}

function fromKobo(value: number): string {
  return (value / 100).toFixed(2);
}

function RecordPaymentDrawer({
  households,
  onRecorded,
}: {
  households: HouseholdOption[];
  onRecorded: () => void;
}) {
  const { requestStepUp, stepUpPrompt } = useStepUpAction();
  const [open, setOpen] = React.useState(false);
  const [householdId, setHouseholdId] = React.useState('');
  const [householdQuery, setHouseholdQuery] = React.useState('');
  const [outstanding, setOutstanding] =
    React.useState<OutstandingResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [selected, setSelected] = React.useState<Record<string, string>>({});
  const [amount, setAmount] = React.useState('');
  const [method, setMethod] = React.useState<PaymentMethod>('transfer');
  const [paidAt, setPaidAt] = React.useState(
    new Date().toISOString().slice(0, 10),
  );
  const [reference, setReference] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  // One key per composed receipt. It deliberately survives a failed attempt —
  // that is what makes the retry safe — and is regenerated when the dialog is
  // opened afresh.
  const [submissionKey, setSubmissionKey] = React.useState('');

  const selectedHousehold = households.find(
    (household) => household.id === householdId,
  );
  const householdMatches = React.useMemo(() => {
    const query = householdQuery.trim().toLowerCase();
    const pool =
      query === ''
        ? households
        : households.filter(
            (household) =>
              household.name.toLowerCase().includes(query) ||
              (household.payerName ?? '').toLowerCase().includes(query),
          );
    return pool.slice(0, 8);
  }, [households, householdQuery]);

  React.useEffect(() => {
    if (!open) return;
    setSubmissionKey(
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : String(Date.now()),
    );
    setHouseholdId('');
    setHouseholdQuery('');
    setOutstanding(null);
    setSelected({});
    setAmount('');
    setReference('');
    setMethod('transfer');
    setPaidAt(new Date().toISOString().slice(0, 10));
  }, [open]);

  // Opening a family shows everything it owes, so the operator never has to go
  // hunting for a child's invoice number.
  React.useEffect(() => {
    if (!householdId) {
      setOutstanding(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const res = await authedFetch(
          `/api/finance/households/${householdId}/outstanding`,
        );
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        const data = (await res.json()) as OutstandingResponse;
        if (cancelled) return;
        setOutstanding(data);
        // Pre-select every open bill at its full balance — the common case is
        // "pay everything", and unticking is easier than typing.
        const preset: Record<string, string> = {};
        for (const invoice of data.invoices ?? []) {
          preset[invoice.id] = fromKobo(invoice.financials?.balance ?? 0);
        }
        setSelected(preset);
        setAmount(fromKobo(data.totalOutstanding ?? 0));
      } catch (e) {
        if (!cancelled) {
          toast.error(
            e instanceof Error
              ? e.message
              : 'Could not load what this family owes',
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [householdId]);

  const invoices = outstanding?.invoices ?? [];
  const selectedInvoices = invoices.filter(
    (invoice) => selected[invoice.id] !== undefined,
  );
  const allocations = selectedInvoices
    .map((invoice) => ({
      invoiceId: invoice.id,
      amount: toKobo(selected[invoice.id] ?? ''),
    }))
    .filter(
      (allocation): allocation is { invoiceId: string; amount: number } =>
        allocation.amount !== null,
    );

  // Anything ticked but unreadable, or allocated past its own balance, is a
  // typo the operator should see before the step-up, not after the server
  // refuses it.
  const unreadable = selectedInvoices.length !== allocations.length;
  const overAllocatedRow = allocations.some((allocation) => {
    const invoice = invoices.find((row) => row.id === allocation.invoiceId);
    return allocation.amount > (invoice?.financials?.balance ?? 0);
  });

  const allocatedTotal = allocations.reduce((sum, a) => sum + a.amount, 0);
  const receivedTotal = toKobo(amount) ?? 0;
  const amountUnreadable = amount.trim() !== '' && toKobo(amount) === null;
  const toCredit = Math.max(0, receivedTotal - allocatedTotal);
  const overAllocated = allocatedTotal > receivedTotal;

  // Money with no family behind it has nowhere to sit: the server refuses it
  // at `createFromOverpayment`, but only after the operator has completed a
  // step-up challenge.
  const canSubmit =
    !!householdId &&
    receivedTotal > 0 &&
    !overAllocated &&
    !overAllocatedRow &&
    !unreadable &&
    !amountUnreadable;

  const toggle = (invoice: OutstandingInvoice, on: boolean) => {
    setSelected((current) => {
      const next = { ...current };
      if (on) next[invoice.id] = fromKobo(invoice.financials?.balance ?? 0);
      else delete next[invoice.id];
      // Keep the amount in step with what is ticked. Without this, unticking a
      // child ("they are only paying for Chidi today") left the total at the
      // family's full outstanding and quietly parked the difference as credit.
      const total = Object.values(next).reduce(
        (sum, value) => sum + (toKobo(value) ?? 0),
        0,
      );
      setAmount(fromKobo(total));
      return next;
    });
  };

  const submit = () => {
    if (!canSubmit) return;
    requestStepUp(
      {
        operation: STEP_UP_OPERATION.FINANCIAL_TRANSACTIONS,
        title: 'Record a payment',
        description:
          'Confirm your identity to record this receipt and settle the selected invoices.',
      },
      async (challengeId) => {
        setBusy(true);
        try {
          const res = await authedFetch('/api/finance/receipts', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              householdId: householdId || undefined,
              method,
              paidAt,
              amount: receivedTotal,
              reference: reference.trim() || undefined,
              allocations,
              // Same key if the operator retries after a lost response, so the
              // family's money is not taken twice.
              idempotencyKey: submissionKey,
              stepUpChallengeId: challengeId,
            }),
          });
          if (!res.ok) {
            const detail = (await res.json().catch(() => null)) as {
              message?: string;
            } | null;
            throw new Error(
              detail?.message ?? `Request failed (${res.status})`,
            );
          }
          const receipt = (await res.json()) as { receiptNumber: string };
          toast.success(`Receipt ${receipt.receiptNumber} recorded`);
          setOpen(false);
          onRecorded();
        } catch (e) {
          toast.error(
            e instanceof Error ? e.message : 'Could not record the payment',
          );
        } finally {
          setBusy(false);
        }
      },
    );
  };

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Wallet /> Record payment
        </Button>
        <DrawerContent>
          <DrawerHeader className="gap-1.5">
            <DrawerTitle className="pr-8">Record a payment</DrawerTitle>
            <SheetDescription className="text-[calc(12.5px*var(--font-scale))]">
              Pick the family, then choose what this money settles. One receipt
              can cover several children; anything left over is held as credit
              against their next invoice.
            </SheetDescription>
          </DrawerHeader>

          <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rp-household">Family account</Label>
              {selectedHousehold ? (
                <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card/40 p-2.5">
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium text-foreground">
                      {selectedHousehold.name}
                    </span>
                    {selectedHousehold.payerName ? (
                      <span className="truncate text-xs text-muted-foreground">
                        {selectedHousehold.payerName}
                      </span>
                    ) : null}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setHouseholdId('');
                      setHouseholdQuery('');
                    }}
                  >
                    Change
                  </Button>
                </div>
              ) : (
                <>
                  {/* A school with 400 families cannot scroll a plain select to
                      start its commonest money-in task. */}
                  <Input
                    id="rp-household"
                    value={householdQuery}
                    onChange={(event) => setHouseholdQuery(event.target.value)}
                    placeholder="Search family or payer…"
                    autoComplete="off"
                  />
                  <ul className="max-h-44 overflow-y-auto rounded-lg border border-border">
                    {householdMatches.length === 0 ? (
                      <li className="p-2.5 text-sm text-muted-foreground">
                        No family matches “{householdQuery}”.
                      </li>
                    ) : (
                      householdMatches.map((household) => (
                        <li key={household.id}>
                          <button
                            type="button"
                            className="flex w-full flex-col items-start gap-0.5 p-2.5 text-left hover:bg-accent"
                            onClick={() => setHouseholdId(household.id)}
                          >
                            <span className="text-sm text-foreground">
                              {household.name}
                            </span>
                            {household.payerName ? (
                              <span className="text-xs text-muted-foreground">
                                {household.payerName}
                              </span>
                            ) : null}
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                </>
              )}
            </div>

            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Loading what this
                family owes…
              </div>
            ) : householdId && invoices.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                This family has nothing outstanding. Money taken now is held as
                credit against their next invoice.
              </p>
            ) : (
              invoices.map((invoice) => {
                const checked = selected[invoice.id] !== undefined;
                return (
                  <div
                    key={invoice.id}
                    className="flex items-center gap-3 rounded-lg border border-border bg-card/40 p-2.5"
                  >
                    <Checkbox
                      id={`rp-${invoice.id}`}
                      checked={checked}
                      onCheckedChange={(value) =>
                        toggle(invoice, value === true)
                      }
                    />
                    <label
                      htmlFor={`rp-${invoice.id}`}
                      className="flex min-w-0 flex-1 flex-col"
                    >
                      <span className="truncate text-sm font-medium text-foreground">
                        {invoice.studentName ?? 'Unnamed student'}
                      </span>
                      {/* The amount owing must never be the thing truncation
                          eats (money always renders in full — lib/format.ts),
                          so only the invoice number gives up room. */}
                      <span className="flex items-baseline text-xs text-muted-foreground">
                        <span className="truncate">
                          {invoice.invoiceNumber}
                          {invoice.termName ? ` · ${invoice.termName}` : ''}
                        </span>
                        <span className="shrink-0 whitespace-nowrap">
                          <Dot />
                          {nairaFromKobo(invoice.financials?.balance ?? 0)}{' '}
                          owing
                        </span>
                      </span>
                    </label>
                    <Input
                      aria-label={`Amount applied to ${invoice.invoiceNumber}`}
                      className="w-32 text-right"
                      inputMode="decimal"
                      disabled={!checked}
                      value={selected[invoice.id] ?? ''}
                      onChange={(event) =>
                        setSelected((current) => ({
                          ...current,
                          [invoice.id]: event.target.value,
                        }))
                      }
                    />
                  </div>
                );
              })
            )}

            <div className="grid gap-3 @md/main:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="rp-amount">Amount received (₦)</Label>
                <Input
                  id="rp-amount"
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="rp-method">Method</Label>
                <Select
                  value={method}
                  onValueChange={(value) => setMethod(value as PaymentMethod)}
                >
                  <SelectTrigger id="rp-method">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(METHOD_LABEL) as PaymentMethod[]).map(
                      (value) => (
                        <SelectItem key={value} value={value}>
                          {METHOD_LABEL[value]}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="rp-date">Date received</Label>
                <Input
                  id="rp-date"
                  type="date"
                  value={paidAt}
                  onChange={(event) => setPaidAt(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="rp-ref">Reference</Label>
                <Input
                  id="rp-ref"
                  value={reference}
                  onChange={(event) => setReference(event.target.value)}
                  placeholder="Transfer ref / cheque number"
                />
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card/40 p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Allocated</span>
                <span className="tabular-nums">
                  {nairaFromKobo(allocatedTotal)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Held as credit</span>
                <span className="tabular-nums">{nairaFromKobo(toCredit)}</span>
              </div>
              {overAllocated ? (
                <p className="mt-2 text-warning">
                  The allocations add up to more than the money received.
                </p>
              ) : null}
              {overAllocatedRow ? (
                <p className="mt-2 text-warning">
                  One of these is for more than that invoice still owes.
                </p>
              ) : null}
              {amountUnreadable || unreadable ? (
                <p className="mt-2 text-warning">
                  Amounts are naira, digits only — e.g. 15000 or 15000.50.
                </p>
              ) : null}
              {!householdId ? (
                <p className="mt-2 text-muted-foreground">
                  Choose the family this money belongs to.
                </p>
              ) : null}
            </div>
          </div>

          <DrawerFooter className="flex-row justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={busy || !canSubmit}>
              {busy ? <Loader2 className="animate-spin" /> : null} Record
              payment
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Sheet>
      {stepUpPrompt}
    </>
  );
}
