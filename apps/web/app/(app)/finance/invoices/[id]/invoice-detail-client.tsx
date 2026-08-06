'use client';

/* ============================================================
   InvoiceDetailClient — one invoice: lines, discounts, balance

   The operational surface for a single invoice. Compose its line items from the
   fee-item catalogue, request/approve discretionary discounts (maker-checker),
   and read the DERIVED balance (gross − applied discounts − paid). Every mutation
   re-fetches via router.refresh so the financials stay in lock-step. Amounts are
   kobo (minor units) end to end. Write controls render only when `canManage`.
   ============================================================ */

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, Check, Pencil, Plus, Trash2, X } from 'lucide-react';

import { Button } from '@workspace/ui/components/button';
import { Input } from '@workspace/ui/components/input';
import { Label } from '@workspace/ui/components/label';
import { Textarea } from '@workspace/ui/components/textarea';
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
import { StatGrid } from '@workspace/ui/custom/layouts/stat-grid';
import { EmptyState } from '@workspace/ui/custom/states/page-states';
import { StatusBadge } from '@workspace/ui/custom/data-display/status-badge';
import type { StateTone } from '@workspace/ui/types/states.types';

import { authedFetch } from '@/lib/authed-fetch';

/* ---- Types (mirror the API response) ------------------------------------ */

export interface CatalogueItem {
  id: string;
  code: string;
  name: string;
  defaultAmount: number | null;
}

interface ApiLine {
  id: string;
  feeItemId: string;
  description?: string | null;
  amount: number;
  quantity: number;
  feeItem?: { code: string; name: string } | null;
}

interface ApiAdjustment {
  id: string;
  type: 'discount' | 'waiver' | 'scholarship' | 'correction';
  source: 'discretionary' | 'policy';
  amount: number;
  reason?: string | null;
  status: 'pending' | 'applied' | 'rejected';
  lineId?: string | null;
}

interface ApiPayment {
  id: string;
  amount: number;
  method?: string | null;
  paidAt?: string | null;
  receiptNumber?: string | null;
  status?: string | null;
}

export interface ApiInvoiceDetail {
  id: string;
  invoiceNumber: string;
  studentId: string;
  studentName?: string | null;
  termName?: string | null;
  termYear?: number | null;
  termCycle?: number | null;
  issuedDate?: string | null;
  dueDate?: string | null;
  amountDue: number;
  amountPaid: number;
  status: string;
  notes?: string | null;
  lines: ApiLine[];
  adjustments: ApiAdjustment[];
  payments: ApiPayment[];
  financials: {
    gross: number;
    discounts: number;
    net: number;
    paid: number;
    balance: number;
    overpaid: number;
  };
}

const ADJUSTMENT_TYPES = [
  'discount',
  'waiver',
  'scholarship',
  'correction',
] as const;

const STATUS_META: Record<string, { label: string; tone: StateTone }> = {
  paid: { label: 'Paid', tone: 'success' },
  partial: { label: 'Part-paid', tone: 'info' },
  overdue: { label: 'Overdue', tone: 'destructive' },
  draft: { label: 'Draft', tone: 'neutral' },
  issued: { label: 'Issued', tone: 'warning' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
};

const ADJ_STATUS_META: Record<string, { label: string; tone: StateTone }> = {
  pending: { label: 'Pending approval', tone: 'warning' },
  applied: { label: 'Applied', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'neutral' },
};

/* ---- Money helpers ------------------------------------------------------ */

function naira(kobo: number | null | undefined): string {
  if (kobo == null) return '—';
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(kobo / 100);
}

function koboFromNaira(input: string): number | null {
  const t = input.trim();
  if (t === '') return null;
  const n = Number(t.replace(/,/g, ''));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(iso));
  } catch {
    return '—';
  }
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** POST/PATCH/DELETE a finance endpoint, toasting the error message on failure. */
async function mutate(
  url: string,
  method: 'POST' | 'PATCH' | 'DELETE',
  body?: unknown,
): Promise<boolean> {
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
  return true;
}

/* ---- Page --------------------------------------------------------------- */

export function InvoiceDetailClient({
  invoice,
  catalogue,
  canManage,
}: {
  invoice: ApiInvoiceDetail;
  catalogue: CatalogueItem[];
  canManage: boolean;
}) {
  const fin = invoice.financials;
  const statusMeta = STATUS_META[invoice.status] ?? {
    label: titleCase(invoice.status),
    tone: 'neutral' as StateTone,
  };

  const statItems = [
    { key: 'gross', label: 'Billed', value: naira(fin.gross) },
    { key: 'discounts', label: 'Discounts', value: naira(fin.discounts) },
    { key: 'net', label: 'Net', value: naira(fin.net) },
    { key: 'paid', label: 'Paid', value: naira(fin.paid) },
    {
      key: 'balance',
      label: fin.overpaid > 0 ? 'Credit' : 'Balance',
      value: fin.overpaid > 0 ? naira(fin.overpaid) : naira(fin.balance),
      delta:
        fin.overpaid > 0
          ? {
              label: 'overpaid',
              direction: 'up' as const,
              intent: 'positive' as const,
            }
          : fin.balance > 0
            ? {
                label: 'due',
                direction: 'up' as const,
                intent: 'negative' as const,
              }
            : undefined,
    },
  ];

  const termLabel = [
    invoice.termName,
    invoice.termYear ? String(invoice.termYear) : null,
    invoice.termCycle ? `cycle ${invoice.termCycle}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

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
            title={invoice.studentName ?? invoice.invoiceNumber}
            meta={[
              { key: 'inv', label: invoice.invoiceNumber, emphasis: true },
              ...(termLabel ? [{ key: 'term', label: termLabel }] : []),
              { key: 'due', label: `Due ${formatDate(invoice.dueDate)}` },
            ]}
            actions={
              <StatusBadge
                tone={statusMeta.tone}
                dot={
                  invoice.status !== 'draft' && invoice.status !== 'cancelled'
                }
              >
                {statusMeta.label}
              </StatusBadge>
            }
          />
        </div>

        <StatGrid items={statItems} />

        <LinesSection
          invoiceId={invoice.id}
          lines={invoice.lines}
          catalogue={catalogue}
          canManage={canManage}
        />

        <AdjustmentsSection
          invoiceId={invoice.id}
          adjustments={invoice.adjustments}
          canManage={canManage}
        />

        {invoice.payments.length > 0 ? (
          <PaymentsSection payments={invoice.payments} />
        ) : null}
      </div>
    </ShellMain>
  );
}

/* ---- Lines -------------------------------------------------------------- */

function SectionCard({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card/40">
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex min-w-0 flex-col">
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          {description ? (
            <p className="text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

function LinesSection({
  invoiceId,
  lines,
  catalogue,
  canManage,
}: {
  invoiceId: string;
  lines: ApiLine[];
  catalogue: CatalogueItem[];
  canManage: boolean;
}) {
  return (
    <SectionCard
      title="Line items"
      description="What this invoice bills for. Gross is the sum of these lines."
      action={
        canManage ? (
          <AddLineDialog invoiceId={invoiceId} catalogue={catalogue} />
        ) : undefined
      }
    >
      {lines.length === 0 ? (
        <EmptyState
          compact
          title="No line items"
          description={
            canManage
              ? 'Add a line from the fee-item catalogue to bill for it.'
              : 'This invoice has no line items yet.'
          }
        />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Unit</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                {canManage ? (
                  <TableHead className="w-0 text-right">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((line) => (
                <TableRow key={line.id}>
                  <TableCell>
                    <div className="flex min-w-0 flex-col">
                      <span className="font-medium text-foreground">
                        {line.feeItem?.name ?? 'Item'}
                      </span>
                      {line.description ? (
                        <span className="text-xs text-muted-foreground">
                          {line.description}
                        </span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {naira(line.amount)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {line.quantity}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {naira(line.amount * line.quantity)}
                  </TableCell>
                  {canManage ? (
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <EditLineDialog line={line} />
                        <RemoveLineButton lineId={line.id} />
                      </div>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </SectionCard>
  );
}

function AddLineDialog({
  invoiceId,
  catalogue,
}: {
  invoiceId: string;
  catalogue: CatalogueItem[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [feeItemId, setFeeItemId] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [amount, setAmount] = React.useState('');
  const [quantity, setQuantity] = React.useState('1');
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setFeeItemId('');
      setDescription('');
      setAmount('');
      setQuantity('1');
    }
  }, [open]);

  const onPickItem = (id: string) => {
    setFeeItemId(id);
    const item = catalogue.find((c) => c.id === id);
    if (item?.defaultAmount != null && amount.trim() === '') {
      setAmount(String(item.defaultAmount / 100));
    }
  };

  const amountKobo = koboFromNaira(amount);
  const qty = Number(quantity);
  const canSubmit =
    feeItemId !== '' &&
    amountKobo != null &&
    amountKobo > 0 &&
    Number.isInteger(qty) &&
    qty >= 1 &&
    !busy;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        size="sm"
        onClick={() => setOpen(true)}
        disabled={catalogue.length === 0}
      >
        <Plus aria-hidden /> Add line
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a line item</DialogTitle>
          <DialogDescription>
            Pick a fee item from the catalogue; the amount pre-fills from its
            default and can be overridden for this invoice.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="line-item">Fee item</Label>
            <Select value={feeItemId} onValueChange={onPickItem}>
              <SelectTrigger id="line-item">
                <SelectValue placeholder="Choose a fee item" />
              </SelectTrigger>
              <SelectContent>
                {catalogue.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="line-amount">Unit amount (₦)</Label>
              <Input
                id="line-amount"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="150000"
                autoComplete="off"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="line-qty">Quantity</Label>
              <Input
                id="line-qty"
                inputMode="numeric"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                autoComplete="off"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="line-desc">
              Description{' '}
              <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="line-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. First term"
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
                await mutate(
                  `/api/finance/invoices/${invoiceId}/lines`,
                  'POST',
                  {
                    feeItemId,
                    amount: amountKobo,
                    quantity: qty,
                    description: description.trim() || undefined,
                  },
                );
                toast.success('Line added');
                setOpen(false);
                router.refresh();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : 'Add failed');
              } finally {
                setBusy(false);
              }
            }}
          >
            Add line
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditLineDialog({ line }: { line: ApiLine }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [amount, setAmount] = React.useState(String(line.amount / 100));
  const [quantity, setQuantity] = React.useState(String(line.quantity));
  const [description, setDescription] = React.useState(line.description ?? '');
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setAmount(String(line.amount / 100));
      setQuantity(String(line.quantity));
      setDescription(line.description ?? '');
    }
  }, [open, line]);

  const amountKobo = koboFromNaira(amount);
  const qty = Number(quantity);
  const canSubmit =
    amountKobo != null &&
    amountKobo > 0 &&
    Number.isInteger(qty) &&
    qty >= 1 &&
    !busy;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant="ghost"
        size="icon"
        className="size-8"
        aria-label="Edit line"
        onClick={() => setOpen(true)}
      >
        <Pencil className="size-4" aria-hidden />
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit line — {line.feeItem?.name ?? 'item'}</DialogTitle>
          <DialogDescription>
            The invoice gross re-derives from the lines when you save.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-amount">Unit amount (₦)</Label>
              <Input
                id="edit-amount"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-qty">Quantity</Label>
              <Input
                id="edit-qty"
                inputMode="numeric"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                autoComplete="off"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-desc">
              Description{' '}
              <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="edit-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
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
                await mutate(`/api/finance/lines/${line.id}`, 'PATCH', {
                  amount: amountKobo,
                  quantity: qty,
                  description: description.trim() || undefined,
                });
                toast.success('Line updated');
                setOpen(false);
                router.refresh();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : 'Update failed');
              } finally {
                setBusy(false);
              }
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RemoveLineButton({ lineId }: { lineId: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant="ghost"
        size="icon"
        className="size-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
        aria-label="Remove line"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="size-4" aria-hidden />
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove this line?</DialogTitle>
          <DialogDescription>
            The invoice gross re-derives without it. This can’t be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" size="sm">
              Cancel
            </Button>
          </DialogClose>
          <Button
            variant="destructive"
            size="sm"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await mutate(`/api/finance/lines/${lineId}`, 'DELETE');
                toast.success('Line removed');
                setOpen(false);
                router.refresh();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : 'Remove failed');
              } finally {
                setBusy(false);
              }
            }}
          >
            Remove
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---- Adjustments -------------------------------------------------------- */

function AdjustmentsSection({
  invoiceId,
  adjustments,
  canManage,
}: {
  invoiceId: string;
  adjustments: ApiAdjustment[];
  canManage: boolean;
}) {
  return (
    <SectionCard
      title="Discounts & adjustments"
      description="Discretionary discounts need a second authority to approve (maker ≠ checker). Only applied ones reduce the balance."
      action={
        canManage ? (
          <RequestAdjustmentDialog invoiceId={invoiceId} />
        ) : undefined
      }
    >
      {adjustments.length === 0 ? (
        <EmptyState
          compact
          title="No adjustments"
          description={
            canManage
              ? 'Request a discount, waiver or scholarship — it applies once approved.'
              : 'No discounts or adjustments on this invoice.'
          }
        />
      ) : (
        <ul className="divide-y divide-border">
          {adjustments.map((adj) => {
            const meta = ADJ_STATUS_META[adj.status] ?? {
              label: titleCase(adj.status),
              tone: 'neutral' as StateTone,
            };
            return (
              <li
                key={adj.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-foreground">
                      {titleCase(adj.type)} · {naira(adj.amount)}
                    </span>
                    <StatusBadge
                      tone={meta.tone}
                      dot={adj.status !== 'rejected'}
                    >
                      {meta.label}
                    </StatusBadge>
                    <span className="text-xs text-muted-foreground">
                      {adj.source === 'policy' ? 'policy' : 'discretionary'}
                    </span>
                  </div>
                  {adj.reason ? (
                    <span className="text-xs text-muted-foreground">
                      {adj.reason}
                    </span>
                  ) : null}
                </div>
                {canManage && adj.status === 'pending' ? (
                  <div className="flex items-center gap-1.5">
                    <ApproveRejectButton
                      adjustmentId={adj.id}
                      action="approve"
                    />
                    <ApproveRejectButton
                      adjustmentId={adj.id}
                      action="reject"
                    />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}

function RequestAdjustmentDialog({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [type, setType] =
    React.useState<(typeof ADJUSTMENT_TYPES)[number]>('discount');
  const [amount, setAmount] = React.useState('');
  const [reason, setReason] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setType('discount');
      setAmount('');
      setReason('');
    }
  }, [open]);

  const amountKobo = koboFromNaira(amount);
  const canSubmit = amountKobo != null && amountKobo > 0 && !busy;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Plus aria-hidden /> Request adjustment
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request a discretionary adjustment</DialogTitle>
          <DialogDescription>
            It stays pending until a different authority approves it — you can’t
            approve your own request.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="adj-type">Type</Label>
              <Select
                value={type}
                onValueChange={(v) =>
                  setType(v as (typeof ADJUSTMENT_TYPES)[number])
                }
              >
                <SelectTrigger id="adj-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ADJUSTMENT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {titleCase(t)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="adj-amount">Amount off (₦)</Label>
              <Input
                id="adj-amount"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="50000"
                autoComplete="off"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="adj-reason">
              Reason <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="adj-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Hardship — approved by principal"
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
                await mutate('/api/finance/adjustments', 'POST', {
                  invoiceId,
                  type,
                  amount: amountKobo,
                  reason: reason.trim() || undefined,
                });
                toast.success('Adjustment requested — awaiting approval');
                setOpen(false);
                router.refresh();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : 'Request failed');
              } finally {
                setBusy(false);
              }
            }}
          >
            Submit request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ApproveRejectButton({
  adjustmentId,
  action,
}: {
  adjustmentId: string;
  action: 'approve' | 'reject';
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const isApprove = action === 'approve';

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant={isApprove ? 'default' : 'outline'}
        size="sm"
        className={
          isApprove
            ? ''
            : 'text-destructive hover:bg-destructive/10 hover:text-destructive'
        }
        onClick={() => setOpen(true)}
      >
        {isApprove ? <Check aria-hidden /> : <X aria-hidden />}
        {isApprove ? 'Approve' : 'Reject'}
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isApprove ? 'Approve this adjustment?' : 'Reject this adjustment?'}
          </DialogTitle>
          <DialogDescription>
            {isApprove
              ? 'Approving applies it and reduces the invoice balance. You must be a different person than the requester.'
              : 'Rejecting leaves the balance unchanged.'}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5 py-2">
          <Label htmlFor="decision-reason">
            Reason{' '}
            <span className="text-muted-foreground">
              {isApprove ? '(optional)' : '(recommended)'}
            </span>
          </Label>
          <Textarea
            id="decision-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={
              isApprove
                ? 'Verified supporting documents'
                : 'Why it was declined'
            }
          />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" size="sm">
              Cancel
            </Button>
          </DialogClose>
          <Button
            variant={isApprove ? 'default' : 'destructive'}
            size="sm"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await mutate(
                  `/api/finance/adjustments/${adjustmentId}/${action}`,
                  'POST',
                  { reason: reason.trim() || undefined },
                );
                toast.success(
                  isApprove ? 'Adjustment applied' : 'Adjustment rejected',
                );
                setOpen(false);
                router.refresh();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : 'Action failed');
              } finally {
                setBusy(false);
              }
            }}
          >
            {isApprove ? 'Approve' : 'Reject'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---- Payments (read-only) ----------------------------------------------- */

function PaymentsSection({ payments }: { payments: ApiPayment[] }) {
  return (
    <SectionCard
      title="Payments"
      description="Receipts recorded against this invoice."
    >
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Receipt</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="text-muted-foreground">
                  {p.receiptNumber ?? p.id}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {p.method ? titleCase(p.method) : '—'}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(p.paidAt)}
                </TableCell>
                <TableCell className="text-right tabular-nums font-medium">
                  {naira(p.amount)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </SectionCard>
  );
}
