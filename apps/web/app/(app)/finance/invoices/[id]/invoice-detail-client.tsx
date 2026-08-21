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

import { apiErrorMessage } from '@/lib/api-client';
import { authedFetch } from '@/lib/authed-fetch';
import { formatNaira as naira, koboFromNaira } from '@/lib/format';
import { STEP_UP_OPERATION } from '@/lib/step-up';
import { useStepUpAction } from '../../../_shared/use-step-up-action';
import { Dot } from '@workspace/ui/custom/data-display/dot';
import { InvoiceTotalsBar, type InvoiceTotals } from './invoice-totals-bar';
import { BilledToBlock, type BilledTo } from '../billed-to';
import { InvoiceDocumentActions } from './invoice-document-actions';
import { stepQuantity } from '@/lib/invoice-lines';
import { LineEntryCard, LineEntryRow, useLineEntry } from '../line-entry';
import { QuantityField } from '../quantity-field';
import {
  PENDING_PREFIX,
  useDraftEditor,
  type DraftHeader,
} from './use-draft-editor';

/** Change one of the draft's details on screen. Saved by "Update draft". */
type PatchHeader = <K extends keyof DraftHeader>(
  field: K,
  value: DraftHeader[K],
) => void;

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
  /**
   * True when the signed-in reader raised this adjustment. Decided by the API,
   * which owns the same maker-checker rule it enforces on approval — the client
   * has no reliable identity of its own. Absent on older payloads, so
   * `undefined` reads as "not mine" and the API stays the backstop.
   */
  isOwnRequest?: boolean;
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
  cancelled: { label: 'Cancelled', tone: 'neutral' },
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
    throw new Error(await apiErrorMessage(res));
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
    header,
    patchHeader,
    financials: fin,
    dirty,
    contents,
    markSaved,
  } = useDraftEditor(invoice);
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
            // The document lives here; the composition's own actions (save,
            // issue) live in the totals bar beside the figure they commit.
            actions={
              <InvoiceDocumentActions
                invoiceId={invoice.id}
                invoiceNumber={invoice.invoiceNumber}
                studentName={invoice.studentName ?? null}
                isDraft={invoice.status === 'draft'}
              />
            }
          />
        </div>

        <LinesSection
          lines={lines}
          setLines={setLines}
          catalogue={catalogue}
          financials={fin}
          billedTo={billedTo}
          totalsActions={
            canManage && invoice.status === 'draft' ? (
              <DraftActions
                invoiceId={invoice.id}
                dirty={dirty}
                contents={contents}
                markSaved={markSaved}
              />
            ) : undefined
          }
          details={
            canManage && invoice.status === 'draft' ? (
              <DraftDetailsFields header={header} patchHeader={patchHeader} />
            ) : undefined
          }
          notes={
            canManage && invoice.status === 'draft' ? (
              <DraftNotesField header={header} patchHeader={patchHeader} />
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
function IssueInvoiceButton({
  invoiceId,
  disabled,
  beforeIssue,
}: {
  invoiceId: string;
  disabled?: boolean;
  /** Run before issuing — used to flush unsaved edits so the right bill goes out. */
  beforeIssue?: () => Promise<unknown>;
}) {
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
          // Issue posts what the SERVER holds, so unsaved edits must land
          // first or the family is billed a version nobody saw.
          if (beforeIssue) await beforeIssue();
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
      <Button size="sm" disabled={busy || disabled} onClick={issue}>
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

/**
 * What a draft can be done with: saved, or issued.
 *
 * Edits are held in the browser now, so "Update draft" is the moment anything
 * reaches the server — one request carrying the whole draft.
 *
 * Issuing saves first when there is anything to save. The alternative is a
 * trap: the issue endpoint posts what the SERVER holds, so issuing with
 * unsaved edits on screen would bill a family for a version the bursar is
 * looking at but has not sent. Saving is not step-up gated, so this still
 * costs exactly one confirmation.
 */
function DraftActions({
  invoiceId,
  dirty,
  contents,
  markSaved,
}: {
  invoiceId: string;
  dirty: boolean;
  contents: () => unknown;
  markSaved: (saved: ApiInvoiceDetail) => void;
}) {
  const [busy, setBusy] = React.useState(false);

  const save = async () => {
    const saved = (await mutate(
      `/api/finance/invoices/${invoiceId}/contents`,
      'PATCH',
      contents(),
    )) as ApiInvoiceDetail | null;
    if (saved) markSaved(saved);
    return saved;
  };

  const onSave = async () => {
    setBusy(true);
    try {
      await save();
      toast.success('Draft saved');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save the draft');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {/* Above the buttons, not beside them: the label changes width with its
          text, so inline it nudged the buttons sideways on every edit. */}
      <span
        className="text-[calc(12.5px*var(--font-scale))] text-muted-foreground"
        role="status"
      >
        {dirty ? 'Unsaved changes' : 'All changes saved'}
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={!dirty || busy}
          onClick={() => void onSave()}
        >
          Update draft
        </Button>
        <IssueInvoiceButton
          invoiceId={invoiceId}
          disabled={busy}
          beforeIssue={dirty ? save : undefined}
        />
      </div>
    </>
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
  header,
  patchHeader,
}: {
  header: DraftHeader;
  patchHeader: PatchHeader;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 border-b border-border px-4 py-4 sm:grid-cols-2 lg:grid-cols-4">
      <DraftField
        patchHeader={patchHeader}
        field="termName"
        label="Term"
        value={header.termName ?? ''}
        placeholder="Spring Term"
      />
      <DraftField
        patchHeader={patchHeader}
        field="termYear"
        label="Year"
        value={header.termYear != null ? String(header.termYear) : ''}
        placeholder="2025"
        numeric
      />
      <DraftField
        patchHeader={patchHeader}
        field="termCycle"
        label="Cycle"
        value={header.termCycle != null ? String(header.termCycle) : ''}
        placeholder="1"
        numeric
      />
      <DraftField
        patchHeader={patchHeader}
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
  header,
  patchHeader,
}: {
  header: DraftHeader;
  patchHeader: PatchHeader;
}) {
  return (
    <div className="border-t border-border px-4 py-4">
      <DraftField
        patchHeader={patchHeader}
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
  patchHeader,
  field,
  label,
  value,
  placeholder,
  type,
  numeric,
  optional,
}: {
  patchHeader: PatchHeader;
  field: 'termName' | 'termYear' | 'termCycle' | 'dueDate' | 'notes';
  label: string;
  value: string;
  placeholder?: string;
  type?: string;
  numeric?: boolean;
  optional?: boolean;
}) {
  const [draft, setDraft] = React.useState(value);
  const inputId = `draft-${field}`;

  // Follows the working copy — which the server replaces wholesale whenever it
  // sends a fresh payload.
  React.useEffect(() => setDraft(value), [value]);

  /** Nothing is written here; "Update draft" sends the whole draft later. */
  const commit = () => {
    const next = draft.trim();
    if (next === value.trim()) return;

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
    patchHeader(field, payload as never);
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
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return;
          e.preventDefault();
          e.currentTarget.blur();
        }}
      />
    </div>
  );
}

function LinesSection({
  lines,
  setLines,
  catalogue,
  editable,
  financials,
  billedTo,
  totalsActions,
  details,
  notes,
}: {
  lines: ApiLine[];
  setLines: React.Dispatch<React.SetStateAction<ApiLine[]>>;
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
  const entry = useLineEntry({
    catalogue,
    onAdd: (value, item) =>
      setLines((current) => [
        ...current,
        {
          // Marks a line the server has not seen; the save sends it without an
          // id and the server creates it.
          id: `${PENDING_PREFIX}${current.length}-${value.feeItemId}`,
          feeItemId: value.feeItemId,
          description: value.description ?? null,
          amount: value.amount,
          quantity: value.quantity,
          feeItem: { code: item.code, name: item.name },
        },
      ]),
  });
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
                    <EditLineDialog line={line} setLines={setLines} />
                    <RemoveLineButton lineId={line.id} setLines={setLines} />
                  </div>
                </TableCell>
              ) : null}
            </TableRow>
          ))}
          {editable ? (
            <LineEntryRow entry={entry} catalogue={catalogue} />
          ) : null}
        </TableBody>
      </Table>
      {/* Outside the table on purpose: inside it, a stacked cell would still
          be as wide as the table's minimum and scroll off just the same. */}
      {editable ? <LineEntryCard entry={entry} catalogue={catalogue} /> : null}
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
  const label = line.feeItem?.name ?? 'line';

  // Derived from the CURRENT list, never from this row's prop: props do not
  // change between two clicks in the same frame, so reading `line.quantity`
  // made four rapid taps all compute the same target and the count moved by
  // one. Covered by lib/invoice-lines.test.ts.
  const step = (delta: number) =>
    setLines((current) => stepQuantity(current, line.id, delta));

  return (
    <QuantityField
      value={line.quantity}
      onChange={(next) => step(next - line.quantity)}
      label={`Quantity of ${label}`}
    />
  );
}

function EditLineDialog({
  line,
  setLines,
}: {
  line: ApiLine;
  setLines: React.Dispatch<React.SetStateAction<ApiLine[]>>;
}) {
  const [open, setOpen] = React.useState(false);
  const [amount, setAmount] = React.useState(String(line.amount / 100));
  const [quantity, setQuantity] = React.useState(String(line.quantity));
  const [description, setDescription] = React.useState(line.description ?? '');

  React.useEffect(() => {
    if (open) {
      setAmount(String(line.amount / 100));
      setQuantity(String(line.quantity));
      setDescription(line.description ?? '');
    }
  }, [open, line]);

  const amountKobo = koboFromNaira(amount);
  const qty = Number(quantity);
  // Nothing async here any more — the edit lands in the working copy and
  // "Update draft" is what talks to the server.
  const canSubmit =
    amountKobo != null && amountKobo > 0 && Number.isInteger(qty) && qty >= 1;

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
            onClick={() => {
              if (amountKobo == null) return;
              setOpen(false);
              setLines((current) =>
                current.map((l) =>
                  l.id === line.id
                    ? {
                        ...l,
                        amount: amountKobo,
                        quantity: qty,
                        description: description.trim() || null,
                      }
                    : l,
                ),
              );
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
  setLines,
}: {
  lineId: string;
  setLines: React.Dispatch<React.SetStateAction<ApiLine[]>>;
}) {
  const [open, setOpen] = React.useState(false);

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
            The invoice gross re-derives without it. It leaves the invoice for
            good when you save the draft.
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
            onClick={() => {
              setOpen(false);
              setLines((current) => current.filter((l) => l.id !== lineId));
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
                  {adj.isOwnRequest ? (
                    // Maker ≠ checker: no Approve for your own request. The
                    // absence of it, next to a Cancel, is the message — a line
                    // of prose on every pending row is clutter.
                    <ApproveRejectButton
                      adjustmentId={adj.id}
                      action="cancel"
                    />
                  ) : (
                    <>
                      <ApproveRejectButton
                        adjustmentId={adj.id}
                        action="approve"
                      />
                      <ApproveRejectButton
                        adjustmentId={adj.id}
                        action="reject"
                      />
                    </>
                  )}
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
  const [busy, setBusy] = React.useState(false);
  const [type, setType] =
    React.useState<(typeof ADJUSTMENT_TYPES)[number]>('discount');
  const [amount, setAmount] = React.useState('');
  const [reason, setReason] = React.useState('');

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

/**
 * `cancel` is the requester withdrawing their own request. It POSTs to the same
 * `reject` route — the server decides, from who is calling, that this is a
 * withdrawal and records `cancelled` rather than `rejected`, so the history
 * never reads as though a second authority refused the discount. Keeping that
 * decision on the server is deliberate: the client must not be the thing that
 * chooses which outcome is written.
 */
function ApproveRejectButton({
  adjustmentId,
  action,
}: {
  adjustmentId: string;
  action: 'approve' | 'reject' | 'cancel';
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const isApprove = action === 'approve';
  const isCancel = action === 'cancel';
  const route = isCancel ? 'reject' : action;

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
        {isApprove ? 'Approve' : isCancel ? 'Cancel request' : 'Reject'}
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isApprove
              ? 'Approve this adjustment?'
              : isCancel
                ? 'Cancel this request?'
                : 'Reject this adjustment?'}
          </DialogTitle>
          <DialogDescription>
            {isApprove
              ? 'Approving applies it and reduces the invoice balance. You must be a different person than the requester.'
              : isCancel
                ? 'This withdraws the request you raised. Nothing is applied and the balance is unchanged.'
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
              {isCancel ? 'Keep request' : 'Cancel'}
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
                  `/api/finance/adjustments/${adjustmentId}/${route}`,
                  'POST',
                  { reason: reason.trim() || undefined },
                );
                toast.success(
                  isApprove
                    ? 'Adjustment applied'
                    : isCancel
                      ? 'Request cancelled'
                      : 'Adjustment rejected',
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
            {isApprove ? 'Approve' : isCancel ? 'Cancel request' : 'Reject'}
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
