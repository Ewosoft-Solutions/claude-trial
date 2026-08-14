'use client';

/**
 * WB3 structured-intake · the application's requirement checklist, grouped by
 * collection stage. Documents upload through F4 (→ R2); fields / measurements
 * capture a typed value; FEES bill + settle through Finance (WB3-5); anything can
 * be waived with a reason. All writes hit
 * /api/admissions/applications/:id/requirements/* (permission-gated).
 */
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Banknote, Check, Upload } from 'lucide-react';

import { Button } from '@workspace/ui/components/button';
import { Input } from '@workspace/ui/components/input';
import { Label } from '@workspace/ui/components/label';
import { StatusBadge } from '@workspace/ui/custom/data-display/status-badge';

import { formatNaira } from '@/lib/format';
import {
  COLLECT_STAGE_LABEL,
  REQUIREMENT_STATUS_TONE,
  errorMessage,
  fileToBase64,
  type FeeValue,
  type Requirement,
} from '../admissions-types';

interface MeasurementField {
  key: string;
  label: string;
}
type ConfigMap = Record<string, Record<string, unknown> | undefined>;

const STAGE_ORDER = ['application', 'offer', 'acceptance', 'enrolment'];
const PAYMENT_METHODS = ['transfer', 'card', 'cash', 'cheque'] as const;
// Client-side guard so oversize files fail fast with a friendly message rather
// than hitting the API body limit; the DTO enforces the real cap server-side.
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** Parse the fee fulfilment's stored value (billed invoice + amount + paid). */
function readFee(value: Requirement['value']): FeeValue {
  return value && typeof value === 'object' ? (value as FeeValue) : {};
}

export function RequirementsPanel({
  applicationId,
  requirements,
  configByRequirementId,
  resolvedFeeByRequirementId,
  canManage,
}: {
  applicationId: string;
  requirements: Requirement[];
  configByRequirementId: ConfigMap;
  /** Fee amount (kobo) resolved from config for THIS applicant's class, or null
   *  (= no fee). Keyed by requirementId; set on the server, never typed here. */
  resolvedFeeByRequirementId: Record<string, number | null>;
  canManage: boolean;
}) {
  const grouped = React.useMemo(() => {
    const by: Record<string, Requirement[]> = {};
    for (const r of requirements) (by[r.collectStage] ??= []).push(r);
    return by;
  }, [requirements]);

  const stages = STAGE_ORDER.filter((s) => grouped[s]?.length);

  if (requirements.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No requirement checklist attached to this application.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {stages.map((stage) => (
        <div key={stage} className="flex flex-col gap-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {COLLECT_STAGE_LABEL[stage] ?? stage}
          </h4>
          <ul className="flex flex-col divide-y rounded-lg border border-border">
            {grouped[stage]!.map((r) => (
              <RequirementRow
                key={r.id}
                applicationId={applicationId}
                requirement={r}
                config={configByRequirementId[r.requirementId]}
                resolvedFee={
                  resolvedFeeByRequirementId[r.requirementId] ?? null
                }
                canManage={canManage}
              />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function RequirementRow({
  applicationId,
  requirement: r,
  config,
  resolvedFee,
  canManage,
}: {
  applicationId: string;
  requirement: Requirement;
  config?: Record<string, unknown>;
  resolvedFee: number | null;
  canManage: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [waiveOpen, setWaiveOpen] = React.useState(false);
  const [waiveReason, setWaiveReason] = React.useState('');
  const fileRef = React.useRef<HTMLInputElement>(null);

  const base = `/api/admissions/applications/${applicationId}/requirements/${r.id}`;
  const fee = r.type === 'fee' ? readFee(r.value) : null;

  async function send(path: string, body: unknown, okMsg: string) {
    setBusy(true);
    try {
      const res = await fetch(`${base}/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        toast.error(await errorMessage(res, 'Action failed'));
        return;
      }
      toast.success(okMsg);
      setOpen(false);
      router.refresh();
    } catch {
      toast.error('Network error — please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function uploadFile(file: File) {
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error('File is too large (max 10 MB).');
      return;
    }
    setBusy(true);
    try {
      const contentBase64 = await fileToBase64(file);
      const res = await fetch(`${base}/document`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mime: file.type || 'application/octet-stream',
          filename: file.name,
          contentBase64,
        }),
      });
      if (!res.ok) {
        toast.error(await errorMessage(res, 'Upload failed'));
        return;
      }
      toast.success('Uploaded');
      router.refresh();
    } catch {
      toast.error('Could not read the file — please try again.');
    } finally {
      setBusy(false);
    }
  }

  function confirmWaive() {
    if (waiveReason.trim()) {
      void send('waive', { reason: waiveReason.trim() }, 'Waived').then(() => {
        setWaiveOpen(false);
        setWaiveReason('');
      });
    }
  }

  return (
    <li className="flex flex-col gap-2 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium">
            {r.label}
            {r.required && <span className="ml-1 text-destructive">*</span>}
          </span>
          <span className="text-xs capitalize text-muted-foreground">
            {r.type}
            {r.type === 'fee'
              ? fee?.amount != null
                ? ` · billed ${formatNaira(fee.amount)}${fee.paid ? ' · paid' : ''}`
                : resolvedFee != null
                  ? ` · ${formatNaira(resolvedFee)}`
                  : ' · no fee'
              : ''}
            {r.status === 'waived' && r.waivedReason
              ? ` · waived: ${r.waivedReason}`
              : ''}
          </span>
        </div>
        <StatusBadge tone={REQUIREMENT_STATUS_TONE[r.status] ?? 'neutral'}>
          {r.status}
        </StatusBadge>
      </div>

      {canManage && (
        <div className="flex flex-wrap items-center gap-2">
          {r.type === 'document' ? (
            <>
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void uploadFile(f);
                  e.target.value = '';
                }}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="mr-1 size-3.5" aria-hidden />
                {r.documentId ? 'Replace file' : 'Upload'}
              </Button>
            </>
          ) : r.type === 'fee' ? (
            <FeeControls
              fee={fee ?? {}}
              status={r.status}
              resolvedAmount={resolvedFee}
              busy={busy}
              onBill={() => void send('bill', {}, 'Billed')}
              onSettle={(body) => void send('settle', body, 'Payment recorded')}
            />
          ) : !open ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => setOpen(true)}
            >
              <Check className="mr-1 size-3.5" aria-hidden />
              {r.status === 'provided' ? 'Update' : 'Provide'}
            </Button>
          ) : (
            <ValueEditor
              type={r.type}
              config={config}
              busy={busy}
              onCancel={() => setOpen(false)}
              onSubmit={(value) => void send('provide', { value }, 'Recorded')}
            />
          )}
          {r.status !== 'waived' && !waiveOpen && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => setWaiveOpen(true)}
            >
              Waive
            </Button>
          )}
        </div>
      )}

      {canManage && waiveOpen && (
        <div className="flex flex-col gap-2 rounded-md bg-muted/40 p-2">
          <Label className="text-xs">Reason for waiving</Label>
          <Input
            value={waiveReason}
            onChange={(e) => setWaiveReason(e.target.value)}
            placeholder="e.g. Fresh entrant — no previous school"
            className="h-8"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setWaiveOpen(false);
                setWaiveReason('');
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={busy || !waiveReason.trim()}
              onClick={confirmWaive}
            >
              Waive
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}

/**
 * WB3-5 fee controls. The fee AMOUNT is configured centrally (admission
 * requirements) and resolved from the applicant's class — it is NOT entered
 * here. A fee that resolves to no amount reads "No fee for this class" and is
 * skipped. Otherwise: a not-yet-billed fee shows "Bill ₦X" (one click creates
 * the invoice at the resolved price); a billed-but-unpaid fee shows "Record
 * payment"; a settled fee (`provided`) shows nothing.
 */
function FeeControls({
  fee,
  status,
  resolvedAmount,
  busy,
  onBill,
  onSettle,
}: {
  fee: FeeValue;
  status: Requirement['status'];
  resolvedAmount: number | null;
  busy: boolean;
  onBill: () => void;
  onSettle: (body: {
    amount: number;
    method: string;
    paidAt: string;
    reference?: string;
  }) => void;
}) {
  const billed = typeof fee.invoiceId === 'string';
  const [paying, setPaying] = React.useState(false);
  const [amount, setAmount] = React.useState('');
  const [method, setMethod] = React.useState<string>('transfer');
  const [reference, setReference] = React.useState('');
  const [paidAt, setPaidAt] = React.useState(() =>
    new Date().toISOString().slice(0, 10),
  );

  const nairaOf = (kobo?: number | null) =>
    kobo != null ? String(kobo / 100) : '';
  const toKobo = (s: string) => Math.round(Number.parseFloat(s) * 100);

  if (!paying) {
    if (status === 'provided') return null;
    if (billed) {
      return (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => {
            setAmount(nairaOf(fee.amount ?? resolvedAmount));
            setPaying(true);
          }}
        >
          <Banknote className="mr-1 size-3.5" aria-hidden />
          Record payment
        </Button>
      );
    }
    // Not billed yet: bill at the centrally-configured price, or show that this
    // class has no fee (so nothing to collect, and it won't block admission).
    if (resolvedAmount == null) {
      return (
        <span className="text-xs text-muted-foreground">
          No fee for this class
        </span>
      );
    }
    return (
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={() => onBill()}
      >
        <Banknote className="mr-1 size-3.5" aria-hidden />
        Bill {formatNaira(resolvedAmount)}
      </Button>
    );
  }

  const kobo = toKobo(amount);
  const valid = Number.isFinite(kobo) && kobo > 0;

  return (
    <div className="flex w-full flex-col gap-2 rounded-md bg-muted/40 p-2">
      <div className="flex flex-col gap-1">
        <Label className="text-xs">Amount paid (₦)</Label>
        <Input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
          placeholder="e.g. 5000"
          className="h-8"
          autoFocus
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-xs">Method</Label>
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          className="h-8 rounded-md border border-input bg-transparent px-2 text-sm capitalize"
        >
          {PAYMENT_METHODS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-xs">Paid on</Label>
        <Input
          type="date"
          value={paidAt}
          onChange={(e) => setPaidAt(e.target.value)}
          className="h-8"
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-xs">Payment reference (optional)</Label>
        <Input
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder="e.g. PSK-3312"
          className="h-8"
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() => setPaying(false)}
        >
          Cancel
        </Button>
        <Button
          size="sm"
          disabled={busy || !valid}
          onClick={() => {
            onSettle({
              amount: kobo,
              method,
              paidAt,
              reference: reference.trim() || undefined,
            });
            // Collapse the form; the refresh re-renders the row's new state.
            setPaying(false);
          }}
        >
          Record payment
        </Button>
      </div>
    </div>
  );
}

function ValueEditor({
  type,
  config,
  busy,
  onSubmit,
  onCancel,
}: {
  type: Requirement['type'];
  config?: Record<string, unknown>;
  busy: boolean;
  onSubmit: (value: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const fields =
    type === 'measurement'
      ? ((config?.fields as MeasurementField[] | undefined) ?? [
          { key: 'value', label: 'Value' },
        ])
      : null;
  const [values, setValues] = React.useState<Record<string, string>>({});
  const [text, setText] = React.useState('');

  function submit() {
    if (type === 'measurement' && fields) {
      const out: Record<string, unknown> = {};
      for (const f of fields) if (values[f.key]) out[f.key] = values[f.key];
      onSubmit(out);
    } else {
      onSubmit({ text: text.trim() });
    }
  }

  return (
    <div className="flex w-full flex-col gap-2 rounded-md bg-muted/40 p-2">
      {type === 'measurement' && fields ? (
        <div className="grid grid-cols-2 gap-2">
          {fields.map((f) => (
            <div key={f.key} className="flex flex-col gap-1">
              <Label className="text-xs">{f.label}</Label>
              <Input
                value={values[f.key] ?? ''}
                onChange={(e) =>
                  setValues((v) => ({ ...v, [f.key]: e.target.value }))
                }
                inputMode="decimal"
                className="h-8"
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Value</Label>
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="h-8"
          />
        </div>
      )}
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" disabled={busy} onClick={submit}>
          Save
        </Button>
      </div>
    </div>
  );
}
