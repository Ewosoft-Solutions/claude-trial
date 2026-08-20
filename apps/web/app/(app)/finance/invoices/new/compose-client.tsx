'use client';

/* ============================================================
   ComposeClient — a new invoice, written in the browser

   Nothing reaches the server until the bursar commits. Choosing a student, its
   term and every line are held locally (and in localStorage, so a reload does
   not cost the work), then ONE request writes the invoice, its lines and — if
   they issued rather than saved — the issue itself.

   One request because `StepUpGuard` consumes the challenge it verifies:
   create-then-issue would ask for two confirmations to complete one action,
   and the second could fail after the first had already written.

   The shape mirrors the invoice route on purpose. A bill being written and a
   bill being read should look like the same document.
   ============================================================ */

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, Pencil, Plus, Trash2 } from 'lucide-react';

import { Button } from '@workspace/ui/components/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@workspace/ui/components/dialog';
import { Input } from '@workspace/ui/components/input';
import { Label } from '@workspace/ui/components/label';
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
import { StatusBadge } from '@workspace/ui/custom/data-display/status-badge';
import { DataTableLayout } from '@workspace/ui/custom/layouts/data-table-layout';

import { authedFetch } from '@/lib/authed-fetch';
import { formatNaira as naira, koboFromNaira } from '@/lib/format';
import { MIN_QUANTITY } from '@/lib/invoice-lines';
import { QuantityField } from '../quantity-field';
import { STEP_UP_OPERATION } from '@/lib/step-up';
import { useStepUpAction } from '../../../_shared/use-step-up-action';
import { BilledToBlock, type BilledTo } from '../billed-to';
import { InvoiceTotalsBar } from '../[id]/invoice-totals-bar';
import type { CatalogueItem } from '../[id]/invoice-detail-client';
import type { StudentOption } from '../student-options';
import {
  useComposeDraft,
  type ComposeDraft,
  type ComposeLine,
} from './use-compose-draft';

/** Local row identity — these lines have no server id until the bill is saved. */
let rowSeq = 0;
const nextKey = () => `row-${(rowSeq += 1)}`;

export function ComposeClient({
  students,
  catalogue,
}: {
  students: StudentOption[];
  catalogue: CatalogueItem[];
}) {
  const router = useRouter();
  const { requestStepUp, stepUpPrompt } = useStepUpAction();
  const { draft, setDraft, ready, stored, resume, discardStored, clear } =
    useComposeDraft();
  const [busy, setBusy] = React.useState(false);

  const student = students.find((s) => s.id === draft.studentId) ?? null;

  const gross = draft.lines.reduce(
    (sum, line) => sum + line.amount * line.quantity,
    0,
  );
  const quantityTotal = draft.lines.reduce(
    (sum, line) => sum + line.quantity,
    0,
  );

  const patch = (next: Partial<ComposeDraft>) =>
    setDraft((current) => ({ ...current, ...next }));

  /**
   * Write it. `issue` decides whether it lands as a draft or as a receivable,
   * inside the same request either way.
   */
  const commit = (issue: boolean) => {
    if (!draft.studentId || busy) return;
    if (draft.lines.length === 0) {
      toast.error('Add at least one line before saving this invoice');
      return;
    }
    requestStepUp(
      {
        operation: STEP_UP_OPERATION.FINANCIAL_FEE_STRUCTURE_UPDATE,
        title: issue ? 'Issue this invoice' : 'Save this invoice',
        description: issue
          ? 'Confirm your identity to issue it. The charge posts to the ledger and any held credit is applied.'
          : 'Confirm your identity to save this invoice as a draft.',
      },
      async (challengeId) => {
        setBusy(true);
        try {
          const year = Number(draft.termYear.trim());
          const cycle = Number(draft.termCycle.trim());
          const res = await authedFetch('/api/finance/invoices/compose', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              studentId: draft.studentId,
              termName: draft.termName.trim() || undefined,
              termYear: Number.isInteger(year) && year > 0 ? year : undefined,
              termCycle:
                Number.isInteger(cycle) && cycle > 0 ? cycle : undefined,
              dueDate: draft.dueDate || undefined,
              notes: draft.notes.trim() || undefined,
              lines: draft.lines.map((line) => ({
                feeItemId: line.feeItemId,
                amount: line.amount,
                quantity: line.quantity,
                description: line.description?.trim() || undefined,
              })),
              issue,
              stepUpChallengeId: challengeId,
            }),
          });
          if (!res.ok) {
            const d = (await res.json().catch(() => null)) as {
              message?: string;
            } | null;
            throw new Error(d?.message ?? `Request failed (${res.status})`);
          }
          const saved = (await res.json()) as { id: string };
          // Only now is the local copy redundant.
          clear();
          toast.success(issue ? 'Invoice issued' : 'Draft saved');
          router.replace(`/finance/invoices/${saved.id}`);
        } catch (e) {
          toast.error(e instanceof Error ? e.message : 'Could not save');
          setBusy(false);
        }
      },
    );
  };

  if (!ready) return null;

  // Something was left half-written. Offer it rather than restoring it: a form
  // that silently refills itself is how someone bills the wrong family.
  if (stored) {
    return (
      <ShellMain>
        <ResumePrompt
          draft={stored}
          students={students}
          onResume={resume}
          onDiscard={discardStored}
        />
      </ShellMain>
    );
  }

  if (!student) {
    return (
      <ShellMain>
        <StudentPicker
          students={students}
          onPick={(picked) => patch({ studentId: picked.id })}
        />
      </ShellMain>
    );
  }

  const billedTo: BilledTo = {
    name: student.name,
    studentNumber: student.studentNumber ?? null,
    className: null,
    householdName: null,
    payerName: null,
  };

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
            title={student.name}
            titleAdornment={<StatusBadge tone="neutral">Unsaved</StatusBadge>}
            meta={[
              { key: 'new', label: 'New invoice', emphasis: true },
              { key: 'kept', label: 'Kept temporarily until you save it' },
            ]}
            actions={
              <Button
                variant="ghost"
                size="sm"
                onClick={() => patch({ studentId: null })}
              >
                Change student
              </Button>
            }
          />
        </div>

        <DataTableLayout
          title="Billing"
          description="What this invoice bills for. Gross is the sum of these lines."
        >
          <BilledToBlock billedTo={billedTo} />

          <div className="grid grid-cols-1 gap-4 border-b border-border px-4 py-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field
              id="c-term"
              label="Term"
              value={draft.termName}
              placeholder="Spring Term"
              onChange={(v) => patch({ termName: v })}
            />
            <Field
              id="c-year"
              label="Year"
              value={draft.termYear}
              placeholder="2025"
              numeric
              onChange={(v) => patch({ termYear: v })}
            />
            <Field
              id="c-cycle"
              label="Cycle"
              value={draft.termCycle}
              placeholder="1"
              numeric
              onChange={(v) => patch({ termCycle: v })}
            />
            <Field
              id="c-due"
              label="Due date"
              value={draft.dueDate}
              type="date"
              onChange={(v) => patch({ dueDate: v })}
            />
          </div>

          <Table className="table-fixed min-w-[46rem]">
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead className="w-36 text-right">Unit</TableHead>
                <TableHead className="w-32 text-right">Qty</TableHead>
                <TableHead className="w-36 text-right">Amount</TableHead>
                <TableHead className="w-24 text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {draft.lines.map((line) => {
                const item = catalogue.find((c) => c.id === line.feeItemId);
                return (
                  <TableRow key={line.key}>
                    <TableCell>
                      <div className="flex min-w-0 flex-col">
                        <span className="font-medium text-foreground">
                          {item?.name ?? 'Item'}
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
                      <QuantityField
                        value={line.quantity}
                        onChange={(next) =>
                          patch({
                            lines: draft.lines.map((l) =>
                              l.key === line.key
                                ? { ...l, quantity: next }
                                : l,
                            ),
                          })
                        }
                        label={`Quantity of ${item?.name ?? 'line'}`}
                      />
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {naira(line.amount * line.quantity)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <ComposeLineDialog
                          line={line}
                          item={item}
                          onSave={(next) =>
                            patch({
                              lines: draft.lines.map((l) =>
                                l.key === line.key ? { ...l, ...next } : l,
                              ),
                            })
                          }
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-muted-foreground hover:text-destructive"
                          aria-label={`Remove ${item?.name ?? 'line'}`}
                          onClick={() =>
                            patch({
                              lines: draft.lines.filter(
                                (l) => l.key !== line.key,
                              ),
                            })
                          }
                        >
                          <Trash2 className="size-4" aria-hidden />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}

              <ComposeEntryRow
                catalogue={catalogue}
                onAdd={(line) => patch({ lines: [...draft.lines, line] })}
              />
            </TableBody>
          </Table>

          <div className="border-t border-border px-4 py-4">
            <Field
              id="c-notes"
              label="Notes"
              optional
              value={draft.notes}
              placeholder="Anything that should be read alongside these lines"
              onChange={(v) => patch({ notes: v })}
            />
          </div>

          <InvoiceTotalsBar
            lineCount={draft.lines.length}
            quantityTotal={quantityTotal}
            financials={{
              gross,
              discounts: 0,
              net: gross,
              paid: 0,
              balance: gross,
              overpaid: 0,
            }}
            actions={
              <>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy || draft.lines.length === 0}
                  onClick={() => commit(false)}
                >
                  Save as draft
                </Button>
                <Button
                  size="sm"
                  disabled={busy || draft.lines.length === 0}
                  onClick={() => commit(true)}
                >
                  Issue invoice
                </Button>
              </>
            }
          />
        </DataTableLayout>
      </div>
      {stepUpPrompt}
    </ShellMain>
  );
}

/**
 * Edit a line that has been added but not yet saved.
 *
 * The saved-draft route has had this from the start; composing did not, so a
 * mistyped note or the wrong quantity meant deleting the line and entering it
 * again. One decision, five fields or fewer — a modal by §3.
 *
 * The price behaves as it does everywhere else, and for the same reason it is
 * enforced on the server: a FIXED item shows its catalogue price read-only,
 * because a new line is billed at that price whatever this form sends. Letting
 * it be typed here would be a field whose value is silently discarded on save.
 */
function ComposeLineDialog({
  line,
  item,
  onSave,
}: {
  line: ComposeLine;
  item: CatalogueItem | undefined;
  onSave: (next: Partial<ComposeLine>) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [amount, setAmount] = React.useState('');
  const [quantity, setQuantity] = React.useState(MIN_QUANTITY);
  const [description, setDescription] = React.useState('');

  const openPriced = item?.pricingMode === 'open';

  React.useEffect(() => {
    if (!open) return;
    setAmount(String(line.amount / 100));
    setQuantity(line.quantity);
    setDescription(line.description ?? '');
  }, [open, line]);

  const amountKobo = openPriced ? koboFromNaira(amount) : line.amount;
  const canSave = amountKobo != null && amountKobo > 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant="ghost"
        size="icon"
        className="size-7 text-muted-foreground"
        aria-label={`Edit ${item?.name ?? 'line'}`}
        onClick={() => setOpen(true)}
      >
        <Pencil className="size-4" aria-hidden />
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit line — {item?.name ?? 'item'}</DialogTitle>
          <DialogDescription>
            {openPriced
              ? 'This item is priced per invoice, so its amount is set here.'
              : 'This item is billed at its catalogue price, which is why the amount is fixed.'}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cl-amount">Unit amount (₦)</Label>
              {openPriced ? (
                <Input
                  id="cl-amount"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  autoComplete="off"
                />
              ) : (
                <span className="flex h-9 items-center tabular-nums text-muted-foreground">
                  {naira(line.amount)}
                </span>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cl-qty">Quantity</Label>
              <QuantityField
                value={quantity}
                onChange={setQuantity}
                className="justify-start"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cl-desc">
              Note <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="cl-desc"
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
            disabled={!canSave}
            onClick={() => {
              if (amountKobo == null) return;
              onSave({
                amount: amountKobo,
                quantity,
                description: description.trim() || undefined,
              });
              setOpen(false);
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** A labelled input. Local state only — nothing here talks to the server. */
function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
  type,
  numeric,
  optional,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  type?: string;
  numeric?: boolean;
  optional?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>
        {label}
        {optional ? (
          <span className="text-muted-foreground"> (optional)</span>
        ) : null}
      </Label>
      <Input
        id={id}
        type={type}
        inputMode={numeric ? 'numeric' : undefined}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

/**
 * The entry row, same as the invoice route's: pick, type, Enter, next.
 *
 * A fixed item's price comes from the catalogue and is shown rather than
 * typed; only an open-priced item is priced here. The server re-resolves this
 * on save, so the form is a convenience, not the rule.
 */
function ComposeEntryRow({
  catalogue,
  onAdd,
}: {
  catalogue: CatalogueItem[];
  onAdd: (line: ComposeLine) => void;
}) {
  const [feeItemId, setFeeItemId] = React.useState('');
  const [amount, setAmount] = React.useState('');
  const [quantity, setQuantity] = React.useState(MIN_QUANTITY);
  const [description, setDescription] = React.useState('');
  const itemRef = React.useRef<HTMLButtonElement>(null);

  const picked = catalogue.find((c) => c.id === feeItemId);
  const openPriced = picked?.pricingMode === 'open';

  const onPickItem = (id: string) => {
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
  // The quantity control cannot emit an invalid count, so there is nothing
  // left to re-check: it is a number by construction.
  const qty = quantity;
  const canAdd = picked != null && amountKobo != null && amountKobo > 0;

  const submit = () => {
    if (!canAdd || amountKobo == null) return;
    onAdd({
      key: nextKey(),
      feeItemId,
      amount: amountKobo,
      quantity: qty,
      description: description.trim() || undefined,
    });
    setFeeItemId('');
    setAmount('');
    setQuantity(MIN_QUANTITY);
    setDescription('');
    itemRef.current?.focus();
  };

  if (catalogue.length === 0) {
    return (
      <TableRow className="bg-muted/30">
        <TableCell colSpan={5} className="text-muted-foreground">
          The fee-item catalogue is empty — add items on the{' '}
          <Link href="/finance/fee-items" className="underline underline-offset-2">
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
      onKeyDown={(e) => {
        if (e.key !== 'Enter') return;
        if ((e.target as HTMLElement).tagName !== 'INPUT') return;
        e.preventDefault();
        submit();
      }}
    >
      <TableCell>
        <div className="flex flex-col gap-1.5">
          <Select value={feeItemId} onValueChange={onPickItem}>
            <SelectTrigger ref={itemRef} aria-label="Fee item" className="h-8">
              <SelectValue placeholder="Add a fee item…" />
            </SelectTrigger>
            <SelectContent>
              {catalogue.map((c) => {
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
          <span className="ml-auto inline-flex h-8 w-28 items-center justify-end tabular-nums text-muted-foreground">
            {picked.defaultAmount != null ? naira(picked.defaultAmount) : '—'}
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
        <Button size="sm" disabled={!canAdd} onClick={submit}>
          <Plus aria-hidden /> Add
        </Button>
      </TableCell>
    </TableRow>
  );
}

/** Offer the half-written bill back rather than restoring it silently. */
function ResumePrompt({
  draft,
  students,
  onResume,
  onDiscard,
}: {
  draft: ComposeDraft;
  students: StudentOption[];
  onResume: () => void;
  onDiscard: () => void;
}) {
  const student = students.find((s) => s.id === draft.studentId);
  const when = draft.savedAt ? new Date(draft.savedAt) : null;
  return (
    <div className="flex max-w-xl flex-col gap-4">
      <PageHeader
        title="Pick up where you left off?"
        meta={[
          {
            key: 'when',
            label: when
              ? `Last edited ${when.toLocaleString('en-GB')}`
              : 'Not yet saved to the school',
          },
        ]}
      />
      <div className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-border bg-card px-4 py-3 text-sm">
        <span className="font-medium">
          {student?.name ?? 'An invoice with no student chosen'}
        </span>
        <span className="text-muted-foreground">
          {draft.lines.length} line{draft.lines.length === 1 ? '' : 's'}
          {draft.termName ? ` · ${draft.termName}` : ''}
        </span>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={onResume}>
          Resume it
        </Button>
        <Button variant="ghost" size="sm" onClick={onDiscard}>
          Start fresh
        </Button>
      </div>
    </div>
  );
}

/** Choose who the bill is for. Nothing is written by choosing. */
function StudentPicker({
  students,
  onPick,
}: {
  students: StudentOption[];
  onPick: (student: StudentOption) => void;
}) {
  const [query, setQuery] = React.useState('');
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
    return pool.slice(0, 12);
  }, [students, query]);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link
          href="/finance/invoices"
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden /> Invoices
        </Link>
        <PageHeader
          title="New invoice"
          meta={[{ key: 'step', label: 'Choose who this bill is for' }]}
        />
      </div>
      <div className="flex max-w-xl flex-col gap-2">
        <Label htmlFor="ni-search">Student</Label>
        <Input
          id="ni-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name or number…"
          autoComplete="off"
          autoFocus
        />
      </div>
      <ul className="flex max-w-xl flex-col gap-1.5">
        {matches.map((student) => (
          <li key={student.id}>
            <Button
              variant="outline"
              onClick={() => onPick(student)}
              className="h-auto w-full justify-between px-3 py-2.5 text-left"
            >
              <span className="flex flex-col items-start gap-0.5">
                <span className="font-medium">{student.name}</span>
                {student.studentNumber ? (
                  <span className="text-xs text-muted-foreground">
                    {student.studentNumber}
                  </span>
                ) : null}
              </span>
              <span className="text-xs text-muted-foreground">Compose</span>
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
