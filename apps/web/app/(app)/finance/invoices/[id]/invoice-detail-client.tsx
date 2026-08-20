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
import { ArrowLeft, Check, Minus, Pencil, Plus, Trash2, X } from 'lucide-react';

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@workspace/ui/components/dialog';
import { Button } from '@workspace/ui/components/button';
import { Input } from '@workspace/ui/components/input';
import { Label } from '@workspace/ui/components/label';
import { Textarea } from '@workspace/ui/components/textarea';
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
import { DataTableLayout } from '@workspace/ui/custom/layouts/data-table-layout';
import { EmptyState } from '@workspace/ui/custom/states/page-states';
import { StatusBadge } from '@workspace/ui/custom/data-display/status-badge';
import type { StateTone } from '@workspace/ui/types/states.types';

import { authedFetch } from '@/lib/authed-fetch';
import { formatNaira as naira, koboFromNaira } from '@/lib/format';
import { STEP_UP_OPERATION } from '@/lib/step-up';
import { useStepUpAction } from '../../../_shared/use-step-up-action';
import { Dot } from '@workspace/ui/custom/data-display/dot';
import { InvoiceTotalsBar, type InvoiceTotals } from './invoice-totals-bar';
import { BilledToBlock, type BilledTo } from '../billed-to';
import { MIN_QUANTITY, stepQuantity } from '@/lib/invoice-lines';
import { QuantityField } from '../quantity-field';
import { useCoalescedWrite } from './use-coalesced-write';
import {
  useOptimisticInvoice,
  type InvoiceHeader,
} from './use-optimistic-invoice';

/** Apply a header edit on screen and write it; false when the write failed. */
type SaveHeader = <K extends keyof InvoiceHeader>(
  field: K,
  value: InvoiceHeader[K],
  write: () => Promise<unknown>,
  failure: string,
) => Promise<boolean>;

/* ---- Types (mirror the API response) ------------------------------------ */

export interface CatalogueItem {
  id: string;
  code: string;
  name: string;
  /**
   * 'fixed' — the catalogue owns the price and the line shows it read-only.
   * 'open'  — the line owns the price (damages, miscellaneous).
   */
  pricingMode: 'fixed' | 'open';
  defaultAmount: number | null;
}

export interface ApiLine {
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
  household?: {
    id: string;
    name: string;
    primaryPayerName?: string | null;
  } | null;
  lines: ApiLine[];
  adjustments: ApiAdjustment[];
  payments: ApiPayment[];
  financials: {
    gross: number;
    discounts: number;
    net: number;
    /** Settled by a payment allocation. */
    allocated?: number;
    /** Settled by drawing on the family's held credit. */
    credited?: number;
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
/**
 * Write, and hand back what the server stored.
 *
 * The body matters now that the screen updates before the response: an added
 * line needs the real id it was given, and the price the server RESOLVED may
 * not be the one that was shown (a fixed item is billed at its catalogue
 * price, whatever the form sent). A DELETE answers with no body, hence null.
 */
async function mutate(
  url: string,
  method: 'POST' | 'PATCH' | 'DELETE',
  body?: unknown,
): Promise<unknown> {
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
  return (await res.json().catch(() => null)) as unknown;
}

/* ---- Page --------------------------------------------------------------- */

export function InvoiceDetailClient({
  invoice,
  catalogue,
  billedTo,
  canManage,
}: {
  invoice: ApiInvoiceDetail;
  catalogue: CatalogueItem[];
  billedTo: BilledTo;
  canManage: boolean;
}) {
  const {
    lines,
    setLines,
    financials: fin,
    optimistic,
    header,
    saveHeader,
  } = useOptimisticInvoice(invoice);
  const statusMeta = STATUS_META[invoice.status] ?? {
    label: titleCase(invoice.status),
    tone: 'neutral' as StateTone,
  };

  const termLabel = [
    header.termName,
    header.termYear ? String(header.termYear) : null,
    header.termCycle ? `cycle ${header.termCycle}` : null,
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
              { key: 'due', label: `Due ${formatDate(header.dueDate)}` },
            ]}
            // State sits with the name, not among the buttons: beside
            // "Issue invoice" the badge read as a second button.
            titleAdornment={
              <StatusBadge
                tone={statusMeta.tone}
                dot={
                  invoice.status !== 'draft' && invoice.status !== 'cancelled'
                }
              >
                {statusMeta.label}
              </StatusBadge>
            }
            // Download/share (the document) will live here; Issue (the
            // composition) lives in the totals bar with the figure it commits.
            actions={undefined}
          />
        </div>

        <LinesSection
          invoiceId={invoice.id}
          lines={lines}
          setLines={setLines}
          optimistic={optimistic}
          catalogue={catalogue}
          financials={fin}
          billedTo={billedTo}
          totalsActions={
            canManage && invoice.status === 'draft' ? (
              <IssueInvoiceButton invoiceId={invoice.id} />
            ) : undefined
          }
          details={
            canManage && invoice.status === 'draft' ? (
              <DraftDetailsFields
                invoiceId={invoice.id}
                header={header}
                saveHeader={saveHeader}
              />
            ) : undefined
          }
          notes={
            canManage && invoice.status === 'draft' ? (
              <DraftNotesField
                invoiceId={invoice.id}
                header={header}
                saveHeader={saveHeader}
              />
            ) : undefined
          }
          // Lines are the charge. Once issued it is in the ledger and on a
          // family's statement, so the API fixes it — changing what is owed
          // after that is an adjustment, which is approved and posted.
          editable={canManage && invoice.status === 'draft'}
        />

        {/* A draft owes nothing yet, so it cannot be discounted: the API
            rejects an adjustment against one. Offering the button anyway put
            a guaranteed error behind it, so the section only appears once
            there is an outstanding bill to reduce. */}
        {invoice.status !== 'draft' ? (
          <AdjustmentsSection
            invoiceId={invoice.id}
            adjustments={invoice.adjustments}
            canManage={canManage}
          />
        ) : null}

        {invoice.payments.length > 0 ? (
          <PaymentsSection payments={invoice.payments} />
        ) : null}
      </div>
    </ShellMain>
  );
}

/** Issue a draft invoice (step-up-gated). Issuing auto-applies active policies. */
function IssueInvoiceButton({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const { requestStepUp, stepUpPrompt } = useStepUpAction();
  const [busy, setBusy] = React.useState(false);

  const issue = () => {
    requestStepUp(
      {
        operation: STEP_UP_OPERATION.FINANCIAL_FEE_STRUCTURE_UPDATE,
        title: 'Issue this invoice',
        description:
          'Confirm your identity to issue the invoice. Active discount policies apply on issue.',
      },
      async (challengeId) => {
        setBusy(true);
        try {
          await mutate(`/api/finance/invoices/${invoiceId}`, 'PATCH', {
            status: 'issued',
            stepUpChallengeId: challengeId,
          });
          toast.success('Invoice issued');
          router.refresh();
        } catch (e) {
          toast.error(
            e instanceof Error ? e.message : 'Could not issue invoice',
          );
        } finally {
          setBusy(false);
        }
      },
    );
  };

  return (
    <>
      <Button size="sm" disabled={busy} onClick={issue}>
        Issue invoice
      </Button>
      {stepUpPrompt}
    </>
  );
}

/* ---- Lines -------------------------------------------------------------- */

/** A titled section on the detail page, framed by the shared table shell so its
 *  card, header gutter and first/last-cell padding match every list in the app. */
function SectionCard({
  title,
  description,
  action,
  empty,
  emptyState,
  skeletonColumns,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  empty?: boolean;
  emptyState?: React.ReactNode;
  skeletonColumns?: number;
  children: React.ReactNode;
}) {
  return (
    <DataTableLayout
      title={title}
      description={description}
      toolbar={action}
      empty={empty}
      emptyState={emptyState}
      skeletonColumns={skeletonColumns}
    >
      {children}
    </DataTableLayout>
  );
}

/* ---- Draft details ------------------------------------------------------ */

/**
 * The details the draft was opened with, editable while it is still a draft.
 *
 * These live inside the billing card rather than in a card of their own: who
 * and when a bill is for is part of the bill, and reading it as a separate
 * object above the lines made one invoice look like two things.
 *
 * Like the lines entry row, the fields are always present while the invoice is
 * editable rather than disclosed by a button, so they are content and not a
 * panel (frontend-conventions §3). They disappear once it is issued — the
 * header pills carry these values, and by then they are fixed.
 */
function DraftDetailsFields({
  invoiceId,
  header,
  saveHeader,
}: {
  invoiceId: string;
  header: InvoiceHeader;
  saveHeader: SaveHeader;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 border-b border-border px-4 py-4 sm:grid-cols-2 lg:grid-cols-4">
      <DraftField
        invoiceId={invoiceId}
        saveHeader={saveHeader}
        field="termName"
        label="Term"
        value={header.termName ?? ''}
        placeholder="Spring Term"
      />
      <DraftField
        invoiceId={invoiceId}
        saveHeader={saveHeader}
        field="termYear"
        label="Year"
        value={header.termYear != null ? String(header.termYear) : ''}
        placeholder="2025"
        numeric
      />
      <DraftField
        invoiceId={invoiceId}
        saveHeader={saveHeader}
        field="termCycle"
        label="Cycle"
        value={header.termCycle != null ? String(header.termCycle) : ''}
        placeholder="1"
        numeric
      />
      <DraftField
        invoiceId={invoiceId}
        saveHeader={saveHeader}
        field="dueDate"
        label="Due date"
        value={header.dueDate ? header.dueDate.slice(0, 10) : ''}
        type="date"
      />
    </div>
  );
}

/**
 * The note, at the foot of the bill.
 *
 * Deliberately after the lines: what a note needs to explain usually becomes
 * apparent while the lines are being entered, not before. Above them it was an
 * empty box asking a question nobody had yet.
 */
function DraftNotesField({
  invoiceId,
  header,
  saveHeader,
}: {
  invoiceId: string;
  header: InvoiceHeader;
  saveHeader: SaveHeader;
}) {
  return (
    <div className="border-t border-border px-4 py-4">
      <DraftField
        invoiceId={invoiceId}
        saveHeader={saveHeader}
        field="notes"
        label="Notes"
        value={header.notes ?? ''}
        placeholder="Anything that should be read alongside these lines"
        optional
      />
    </div>
  );
}

/**
 * One draft detail, saved when it loses focus.
 *
 * Saving per keystroke would put a write behind every character of a term name;
 * saving on blur (and on Enter, which matches how the lines entry row commits)
 * writes once per field the bursar actually changed. Only the edited field is
 * sent, so the server's "absent means leave it" contract holds and two fields
 * edited in turn never overwrite one another.
 */
function DraftField({
  invoiceId,
  saveHeader,
  field,
  label,
  value,
  placeholder,
  type,
  numeric,
  optional,
}: {
  invoiceId: string;
  saveHeader: SaveHeader;
  field: 'termName' | 'termYear' | 'termCycle' | 'dueDate' | 'notes';
  label: string;
  value: string;
  placeholder?: string;
  type?: string;
  numeric?: boolean;
  optional?: boolean;
}) {
  const [draft, setDraft] = React.useState(value);
  const [busy, setBusy] = React.useState(false);
  const inputId = `draft-${field}`;

  // The server is the source of truth: after a save (or another edit elsewhere)
  // a refresh brings a new value down, and the field follows it.
  React.useEffect(() => setDraft(value), [value]);

  const commit = async () => {
    const next = draft.trim();
    if (next === value.trim() || busy) return;

    // An emptied field clears the column rather than storing "".
    let payload: string | number | null = next === '' ? null : next;
    if (numeric && payload !== null) {
      const n = Number(payload);
      if (!Number.isInteger(n) || n < 0) {
        toast.error(`${label} must be a whole number`);
        setDraft(value);
        return;
      }
      payload = n;
    }

    setBusy(true);
    // The pill in the page header follows this immediately; only the write is
    // behind, and a failure puts both back.
    const ok = await saveHeader(
      field,
      payload as never,
      () =>
        mutate(`/api/finance/invoices/${invoiceId}/header`, 'PATCH', {
          [field]: payload,
        }),
      `Could not save ${label}`,
    );
    if (!ok) setDraft(value);
    setBusy(false);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={inputId}>
        {label}
        {optional ? (
          <span className="text-muted-foreground"> (optional)</span>
        ) : null}
      </Label>
      <Input
        id={inputId}
        type={type}
        inputMode={numeric ? 'numeric' : undefined}
        value={draft}
        placeholder={placeholder}
        autoComplete="off"
        disabled={busy}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return;
          e.preventDefault();
          e.currentTarget.blur();
        }}
      />
    </div>
  );
}

type Optimistic = (
  next: (current: ApiLine[]) => ApiLine[],
  write: () => Promise<unknown>,
  failure: string,
) => Promise<unknown>;

function LinesSection({
  invoiceId,
  lines,
  setLines,
  optimistic,
  catalogue,
  editable,
  financials,
  billedTo,
  totalsActions,
  details,
  notes,
}: {
  invoiceId: string;
  lines: ApiLine[];
  setLines: React.Dispatch<React.SetStateAction<ApiLine[]>>;
  optimistic: Optimistic;
  catalogue: CatalogueItem[];
  editable: boolean;
  financials: InvoiceTotals;
  billedTo: BilledTo;
  totalsActions?: React.ReactNode;
  /** Who and when the bill is for — rendered above the lines. */
  details?: React.ReactNode;
  /** The note — rendered under the lines, where the need for one shows up. */
  notes?: React.ReactNode;
}) {
  return (
    <SectionCard
      title="Billing"
      description={
        editable
          ? 'What this invoice bills for. Gross is the sum of these lines.'
          : 'What this invoice bills for. Fixed once the invoice was issued — use an adjustment to change what is owed.'
      }
      // While the invoice is editable the table always renders: the entry row
      // at its foot IS how a line is added, so an empty state in its place
      // would take away the only way in.
      empty={lines.length === 0 && !editable}
      skeletonColumns={editable ? 5 : 4}
      emptyState={
        <EmptyState
          compact
          title="No line items"
          description="This invoice has no line items yet."
        />
      }
    >
      <BilledToBlock billedTo={billedTo} />
      {details}
      {/* `table-fixed` with declared column widths: the default auto layout
          sizes columns from their content, so every character typed into the
          amount re-measured all four and the row jumped sideways as you
          typed. Fixed columns cannot move, whatever lands in them. */}
      <Table className="table-fixed min-w-[46rem]">
        <TableHeader>
          <TableRow>
            <TableHead>Item</TableHead>
            <TableHead className="w-36 text-right">Unit</TableHead>
            <TableHead className="w-32 text-right">Qty</TableHead>
            <TableHead className="w-36 text-right">Amount</TableHead>
            {editable ? (
              <TableHead className="w-24 text-right">
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
                {editable ? (
                  <QtyStepper line={line} setLines={setLines} />
                ) : (
                  line.quantity
                )}
              </TableCell>
              <TableCell className="text-right tabular-nums font-medium">
                {naira(line.amount * line.quantity)}
              </TableCell>
              {editable ? (
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <EditLineDialog line={line} optimistic={optimistic} />
                    <RemoveLineButton
                      lineId={line.id}
                      optimistic={optimistic}
                    />
                  </div>
                </TableCell>
              ) : null}
            </TableRow>
          ))}
          {editable ? (
            <NewLineRow
              invoiceId={invoiceId}
              catalogue={catalogue}
              setLines={setLines}
            />
          ) : null}
        </TableBody>
      </Table>
      {notes}
      <InvoiceTotalsBar
        lineCount={lines.length}
        quantityTotal={lines.reduce((sum, l) => sum + l.quantity, 0)}
        financials={financials}
        actions={totalsActions}
      />
    </SectionCard>
  );
}

/**
 * Qty − / + on the row itself.
 *
 * The buttons are always rendered rather than revealed on hover, so the figure
 * never changes column when a row becomes active — the alignment trap a till's
 * inline action strip falls into, where the numbers end up reading one row low.
 *
 * Tapping is instant and the write follows once the tapping stops, so four
 * taps are one request carrying the figure landed on rather than four racing
 * each other to a value already left behind.
 *
 * The next quantity is derived from the CURRENT list, never from this row's
 * prop: props do not change between two clicks in the same frame, so reading
 * `line.quantity` made four rapid taps all compute the same target and the
 * count moved by one.
 */
function QtyStepper({
  line,
  setLines,
}: {
  line: ApiLine;
  setLines: React.Dispatch<React.SetStateAction<ApiLine[]>>;
}) {
  const router = useRouter();
  const schedule = useCoalescedWrite();
  const label = line.feeItem?.name ?? 'line';

  const step = (delta: number) => {
    let target = line.quantity;
    setLines((current) => {
      const next = stepQuantity(current, line.id, delta);
      target = next.find((l) => l.id === line.id)?.quantity ?? target;
      return next;
    });

    schedule(line.id, () => {
      void mutate(`/api/finance/lines/${line.id}`, 'PATCH', {
        quantity: target,
      }).catch((e: unknown) => {
        toast.error(e instanceof Error ? e.message : 'Update failed');
        // Rebuilding the pre-click state across a coalesced burst would be
        // guesswork; asking the server what the line actually is now is both
        // simpler and correct. Failures here are rare enough to afford it.
        router.refresh();
      });
    });
  };

  return (
    <div className="flex items-center justify-end gap-0.5">
      <Button
        variant="ghost"
        size="icon"
        className="size-6"
        disabled={line.quantity <= 1}
        aria-label={`Decrease quantity of ${label}`}
        onClick={() => step(-1)}
      >
        <Minus className="size-3.5" aria-hidden />
      </Button>
      <span className="min-w-[2ch] text-center tabular-nums">
        {line.quantity}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="size-6"
        aria-label={`Increase quantity of ${label}`}
        onClick={() => step(1)}
      >
        <Plus className="size-3.5" aria-hidden />
      </Button>
    </div>
  );
}

/**
 * The entry row — the last row of the lines table, always present while the
 * invoice is a draft.
 *
 * Composing a bill was a modal per line: open, pick, type, save, wait, repeat.
 * A till does the same job in one row because the charges are typed where the
 * charges are shown — Enter commits the line and hands the cursor back for the
 * next one. This is that row: the invoice's own content, not a form panel
 * disclosed over it (frontend-conventions §3).
 */
function NewLineRow({
  invoiceId,
  catalogue,
  setLines,
}: {
  invoiceId: string;
  catalogue: CatalogueItem[];
  setLines: React.Dispatch<React.SetStateAction<ApiLine[]>>;
}) {
  const [feeItemId, setFeeItemId] = React.useState('');
  const [amount, setAmount] = React.useState('');
  const [quantity, setQuantity] = React.useState(MIN_QUANTITY);
  const [description, setDescription] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const itemRef = React.useRef<HTMLButtonElement>(null);

  const picked = catalogue.find((c) => c.id === feeItemId);
  // A till does not let you type a price for stock. A fixed item carries its
  // price on the item record and the line shows it, read-only; only an
  // open-price item — damages, miscellaneous — is priced here. The server
  // enforces this too, so a crafted request cannot discount tuition.
  const openPriced = picked?.pricingMode === 'open';

  const onPickItem = (id: string) => {
    setFeeItemId(id);
    const item = catalogue.find((c) => c.id === id);
    // A fixed item's price is shown, not typed; an open one starts blank.
    setAmount(
      item && item.pricingMode !== 'open' && item.defaultAmount != null
        ? String(item.defaultAmount / 100)
        : '',
    );
  };

  const amountKobo = koboFromNaira(amount);
  // The control cannot produce an invalid count, so there is nothing left to
  // re-check here — it is a number by construction.
  const qty = quantity;
  const canSubmit =
    feeItemId !== '' && amountKobo != null && amountKobo > 0 && !busy;

  const submit = async () => {
    if (!canSubmit || amountKobo == null || picked == null) return;

    // The row appears immediately under a placeholder id, and the real row
    // replaces it when the server answers. Clearing the form here rather than
    // after the write is what lets the next line be typed straight away.
    const placeholderId = `pending-${Date.now()}`;
    const optimisticLine: ApiLine = {
      id: placeholderId,
      feeItemId,
      description: description.trim() || null,
      amount: amountKobo,
      quantity: qty,
      feeItem: { code: picked.code, name: picked.name },
    };
    const payload = {
      feeItemId,
      amount: amountKobo,
      quantity: qty,
      description: description.trim() || undefined,
    };

    setLines((current) => [...current, optimisticLine]);
    setFeeItemId('');
    setAmount('');
    setQuantity(MIN_QUANTITY);
    setDescription('');
    itemRef.current?.focus();
    setBusy(true);

    try {
      const saved = (await mutate(
        `/api/finance/invoices/${invoiceId}/lines`,
        'POST',
        payload,
      )) as ApiLine | null;
      // Swap in what the server actually stored — the price it resolved may
      // differ from the one shown, and later edits need its real id.
      setLines((current) =>
        current.map((l) =>
          l.id === placeholderId
            ? { ...optimisticLine, ...(saved ?? {}), id: saved?.id ?? l.id }
            : l,
        ),
      );
    } catch (e) {
      setLines((current) => current.filter((l) => l.id !== placeholderId));
      toast.error(e instanceof Error ? e.message : 'Add failed');
    } finally {
      setBusy(false);
    }
  };

  if (catalogue.length === 0) {
    return (
      <TableRow className="bg-muted/30">
        <TableCell colSpan={5} className="text-muted-foreground">
          The fee-item catalogue is empty — add items on the{' '}
          <Link
            href="/finance/fee-items"
            className="underline underline-offset-2"
          >
            fee items
          </Link>{' '}
          page to bill for them.
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow
      className="bg-muted/30 hover:bg-muted/40"
      // Enter commits, but only from a text field: the select's own Enter is
      // how an item gets chosen, and must not also add the line.
      onKeyDown={(e) => {
        if (e.key !== 'Enter') return;
        if ((e.target as HTMLElement).tagName !== 'INPUT') return;
        e.preventDefault();
        void submit();
      }}
    >
      <TableCell>
        <div className="flex flex-col gap-1.5">
          <Select value={feeItemId} onValueChange={onPickItem}>
            <SelectTrigger
              ref={itemRef}
              aria-label="Fee item"
              className="h-8 min-w-44"
            >
              <SelectValue placeholder="Add a fee item…" />
            </SelectTrigger>
            <SelectContent>
              {catalogue.map((c) => {
                // A fixed item with no price is a configuration error, not a
                // free bill — the server refuses it, so don't offer it.
                const unpriced =
                  c.pricingMode !== 'open' && c.defaultAmount == null;
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
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            aria-label="Line description"
            placeholder="Note (optional)"
            autoComplete="off"
            disabled={!picked}
            className="h-7 text-xs"
          />
        </div>
      </TableCell>
      <TableCell className="align-top text-right">
        {picked && !openPriced ? (
          // Shown, not editable: the catalogue owns this number. Changing it
          // is a deliberate override on a committed line, not a field left
          // open while adding.
          <span className="ml-auto inline-flex h-8 w-28 items-center justify-end tabular-nums text-muted-foreground">
            {picked.defaultAmount != null
              ? naira(picked.defaultAmount)
              : 'No price'}
          </span>
        ) : (
          <Input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-label="Unit amount in naira"
            inputMode="decimal"
            placeholder="0.00"
            autoComplete="off"
            disabled={!picked}
            className="ml-auto h-8 w-28 text-right tabular-nums"
          />
        )}
      </TableCell>
      <TableCell className="align-top text-right">
        <QuantityField
          value={quantity}
          onChange={setQuantity}
          disabled={!picked}
        />
      </TableCell>
      <TableCell className="align-top text-right font-medium leading-8 tabular-nums">
        {amountKobo != null ? naira(amountKobo * qty) : '—'}
      </TableCell>
      <TableCell className="align-top text-right">
        <Button size="sm" disabled={!canSubmit} onClick={() => void submit()}>
          <Plus aria-hidden /> Add
        </Button>
      </TableCell>
    </TableRow>
  );
}

function EditLineDialog({
  line,
  optimistic,
}: {
  line: ApiLine;
  optimistic: Optimistic;
}) {
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
              if (amountKobo == null) return;
              setBusy(true);
              setOpen(false);
              const next = {
                amount: amountKobo,
                quantity: qty,
                description: description.trim() || undefined,
              };
              await optimistic(
                (current) =>
                  current.map((l) =>
                    l.id === line.id
                      ? { ...l, ...next, description: next.description ?? null }
                      : l,
                  ),
                () => mutate(`/api/finance/lines/${line.id}`, 'PATCH', next),
                'Could not update the line',
              );
              setBusy(false);
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RemoveLineButton({
  lineId,
  optimistic,
}: {
  lineId: string;
  optimistic: Optimistic;
}) {
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
              // The row goes now; if the delete fails it comes back and the
              // toast says why, which beats a spinner over a decision already
              // confirmed.
              setOpen(false);
              await optimistic(
                (current) => current.filter((l) => l.id !== lineId),
                () => mutate(`/api/finance/lines/${lineId}`, 'DELETE'),
                'Could not remove the line',
              );
              setBusy(false);
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
      empty={adjustments.length === 0}
      emptyState={
        <EmptyState
          compact
          title="No adjustments"
          description={
            canManage
              ? 'Request a discount, waiver or scholarship — it applies once approved.'
              : 'No discounts or adjustments on this invoice.'
          }
        />
      }
    >
      <ul className="divide-y divide-border">
        {adjustments.map((adj) => {
          const meta = ADJ_STATUS_META[adj.status] ?? {
            label: titleCase(adj.status),
            tone: 'neutral' as StateTone,
          };
          return (
            <li
              key={adj.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6"
            >
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-foreground">
                    {titleCase(adj.type)}
                    <Dot />
                    {naira(adj.amount)}
                  </span>
                  <StatusBadge tone={meta.tone} dot={adj.status !== 'rejected'}>
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
                  <ApproveRejectButton adjustmentId={adj.id} action="approve" />
                  <ApproveRejectButton adjustmentId={adj.id} action="reject" />
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
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
      skeletonColumns={4}
    >
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
    </SectionCard>
  );
}
