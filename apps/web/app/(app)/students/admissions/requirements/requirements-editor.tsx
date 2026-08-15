'use client';

/**
 * WB3-5 · Admission requirements editor. The per-tenant, configurable checklist
 * (documents / measurements / fees) collected across the admissions journey.
 * Fee rows carry pricing — a default plus optional per-class and per-section
 * overrides — which the applicant detail page resolves and bills (never typed by
 * hand there). All writes hit the `/api/admissions/requirements*` proxy;
 * `admissions.criteria` is enforced server-side.
 */
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Banknote, Plus } from 'lucide-react';

import { Button } from '@workspace/ui/components/button';
import { Input } from '@workspace/ui/components/input';
import { Label } from '@workspace/ui/components/label';
import { Checkbox } from '@workspace/ui/components/checkbox';
import { PageHeader } from '@workspace/ui/custom/shell/page-header';
import { ShellMain } from '@workspace/ui/custom/shell/app-shell';
import { EmptyState } from '@workspace/ui/custom/states/page-states';
import { StatusBadge } from '@workspace/ui/custom/data-display/status-badge';

import { formatNaira } from '@/lib/format';

export interface RequirementTemplateRow {
  id: string;
  key: string;
  label: string;
  type: 'document' | 'field' | 'measurement' | 'fee';
  collectStage: 'application' | 'offer' | 'acceptance' | 'enrolment';
  required: boolean;
  active: boolean;
  order: number;
  config?: Record<string, unknown> | null;
}

interface FeeConfig {
  currency?: string;
  amount?: number | null;
  classPrices?: Record<string, number>;
  sectionPrices?: Record<string, number>;
}

const TYPES = ['document', 'field', 'measurement', 'fee'] as const;
const STAGES = ['application', 'offer', 'acceptance', 'enrolment'] as const;
const STAGE_LABEL: Record<string, string> = {
  application: 'At application',
  offer: 'On offer',
  acceptance: 'On acceptance',
  enrolment: 'At enrolment',
};

/** Parse a ₦ amount (naira, optional decimals) into kobo; null when blank. */
function koboFromNaira(input: string): number | null {
  const trimmed = input.trim();
  if (trimmed === '') return null;
  const naira = Number(trimmed.replace(/,/g, ''));
  if (!Number.isFinite(naira) || naira < 0) return null;
  return Math.round(naira * 100);
}

/** kobo → a plain naira string for an input (empty when unset). */
function nairaValue(kobo: number | null | undefined): string {
  return typeof kobo === 'number' ? String(kobo / 100) : '';
}

function readFeeConfig(config: RequirementTemplateRow['config']): FeeConfig {
  const c =
    config && typeof config === 'object' && !Array.isArray(config)
      ? (config as Record<string, unknown>)
      : {};
  const amount =
    typeof c['amount'] === 'number' ? (c['amount'] as number) : null;
  const classPrices =
    c['classPrices'] && typeof c['classPrices'] === 'object'
      ? (c['classPrices'] as Record<string, number>)
      : {};
  const sectionPrices =
    c['sectionPrices'] && typeof c['sectionPrices'] === 'object'
      ? (c['sectionPrices'] as Record<string, number>)
      : {};
  return { currency: 'NGN', amount, classPrices, sectionPrices };
}

export function RequirementsEditor({
  requirements,
  yearLevels,
  sections,
  canManage,
  embedded,
}: {
  requirements: RequirementTemplateRow[];
  yearLevels: { id: string; name: string }[];
  sections: { id: string; displayLabel: string }[];
  canManage: boolean;
  /** Rendered inside the unified authoring shell — skip the page chrome. */
  embedded?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [adding, setAdding] = React.useState(false);

  async function send(
    method: 'POST' | 'PATCH',
    path: string,
    body: unknown,
    okMsg: string,
  ): Promise<boolean> {
    setBusy(true);
    try {
      const res = await fetch(`/api/admissions/${path}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        toast.error(text?.slice(0, 200) || 'Action failed');
        return false;
      }
      toast.success(okMsg);
      router.refresh();
      return true;
    } catch {
      toast.error('Network error — please try again.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  const grouped = React.useMemo(() => {
    const by: Record<string, RequirementTemplateRow[]> = {};
    for (const r of [...requirements].sort(
      (a, b) => a.order - b.order || a.label.localeCompare(b.label),
    )) {
      (by[r.collectStage] ??= []).push(r);
    }
    return by;
  }, [requirements]);

  const stages = STAGES.filter((s) => grouped[s]?.length);

  const headerActions = canManage ? (
    <div className="flex items-center gap-2">
      {requirements.length === 0 && (
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() =>
            void send(
              'POST',
              'requirements/ensure-defaults',
              undefined,
              'Seeded the standard checklist',
            )
          }
        >
          Seed standard checklist
        </Button>
      )}
      <Button type="button" disabled={busy} onClick={() => setAdding(true)}>
        <Plus className="mr-1 size-4" aria-hidden />
        Add requirement
      </Button>
    </div>
  ) : undefined;

  const body = (
    <>
      {embedded ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <p className="max-w-3xl text-sm text-muted-foreground">
            Documents, measurements and fees the school collects across the
            admissions journey. Fee prices are set here (a default, with
            optional per-class and per-section overrides) and billed
            automatically from the applicant&rsquo;s class.
          </p>
          {headerActions}
        </div>
      ) : (
        <PageHeader
          title="Admission requirements"
          description="Configure what the school collects across the admissions journey — documents, measurements and fees. Fee prices are set here (a default, with optional per-class and per-section overrides) and billed automatically from the applicant's class."
          actions={headerActions}
        />
      )}

      {requirements.length === 0 ? (
        <EmptyState
          title="No requirements yet"
          description={
            canManage
              ? 'Seed the standard Nigerian checklist to get started, or add your own.'
              : 'An administrator has not configured the admission requirements yet.'
          }
        />
      ) : (
        <div className="flex flex-col gap-6">
          {adding && canManage && (
            <AddRequirement
              busy={busy}
              onCancel={() => setAdding(false)}
              onSubmit={async (body) => {
                const ok = await send(
                  'POST',
                  'requirements',
                  body,
                  'Requirement added',
                );
                if (ok) setAdding(false);
              }}
            />
          )}
          {stages.map((stage) => (
            <section key={stage} className="flex flex-col gap-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {STAGE_LABEL[stage] ?? stage}
              </h3>
              <div className="flex flex-col gap-3">
                {grouped[stage]!.map((r) => (
                  <RequirementCard
                    key={r.id}
                    requirement={r}
                    yearLevels={yearLevels}
                    sections={sections}
                    canManage={canManage}
                    busy={busy}
                    onSave={(body) =>
                      send('PATCH', `requirements/${r.id}`, body, 'Saved')
                    }
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );

  return embedded ? (
    <div className="flex flex-col gap-6">{body}</div>
  ) : (
    <ShellMain>{body}</ShellMain>
  );
}

function RequirementCard({
  requirement: r,
  yearLevels,
  sections,
  canManage,
  busy,
  onSave,
}: {
  requirement: RequirementTemplateRow;
  yearLevels: { id: string; name: string }[];
  sections: { id: string; displayLabel: string }[];
  canManage: boolean;
  busy: boolean;
  onSave: (body: Record<string, unknown>) => Promise<boolean>;
}) {
  const [editing, setEditing] = React.useState(false);
  const [label, setLabel] = React.useState(r.label);
  const [collectStage, setCollectStage] = React.useState(r.collectStage);
  const [required, setRequired] = React.useState(r.required);
  const [active, setActive] = React.useState(r.active);

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium">
            {r.label}
            {r.required && <span className="ml-1 text-destructive">*</span>}
          </span>
          <span className="text-xs capitalize text-muted-foreground">
            {r.type}
            {!r.active ? ' · disabled' : ''}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {!r.active && <StatusBadge tone="neutral">disabled</StatusBadge>}
          {canManage && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => setEditing((v) => !v)}
            >
              {editing ? 'Close' : 'Edit'}
            </Button>
          )}
        </div>
      </div>

      {canManage && editing && (
        <div className="mt-3 flex flex-col gap-3 rounded-md bg-muted/40 p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Label</Label>
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="h-8"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Collected at</Label>
              <select
                value={collectStage}
                onChange={(e) =>
                  setCollectStage(
                    e.target.value as RequirementTemplateRow['collectStage'],
                  )
                }
                className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
              >
                {STAGES.map((s) => (
                  <option key={s} value={s}>
                    {STAGE_LABEL[s]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={required}
                onCheckedChange={(v) => setRequired(v === true)}
              />
              Required
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={active}
                onCheckedChange={(v) => setActive(v === true)}
              />
              Active
            </label>
          </div>
          <div className="flex justify-end">
            <Button
              size="sm"
              disabled={busy || !label.trim()}
              onClick={async () => {
                const ok = await onSave({
                  label: label.trim(),
                  collectStage,
                  required,
                  active,
                });
                if (ok) setEditing(false);
              }}
            >
              Save details
            </Button>
          </div>
        </div>
      )}

      {r.type === 'fee' && (
        <FeePricingEditor
          requirement={r}
          yearLevels={yearLevels}
          sections={sections}
          canManage={canManage}
          busy={busy}
          onSave={onSave}
        />
      )}
    </div>
  );
}

function FeePricingEditor({
  requirement: r,
  yearLevels,
  sections,
  canManage,
  busy,
  onSave,
}: {
  requirement: RequirementTemplateRow;
  yearLevels: { id: string; name: string }[];
  sections: { id: string; displayLabel: string }[];
  canManage: boolean;
  busy: boolean;
  onSave: (body: Record<string, unknown>) => Promise<boolean>;
}) {
  const initial = React.useMemo(() => readFeeConfig(r.config), [r.config]);
  const [amount, setAmount] = React.useState(nairaValue(initial.amount));
  const [classPrices, setClassPrices] = React.useState<Record<string, string>>(
    () =>
      Object.fromEntries(
        yearLevels.map((y) => [y.id, nairaValue(initial.classPrices?.[y.id])]),
      ),
  );
  const [sectionPrices, setSectionPrices] = React.useState<
    Record<string, string>
  >(() =>
    Object.fromEntries(
      sections.map((s) => [s.id, nairaValue(initial.sectionPrices?.[s.id])]),
    ),
  );
  const [open, setOpen] = React.useState(false);

  function collectMap(prices: Record<string, string>): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [id, val] of Object.entries(prices)) {
      const kobo = koboFromNaira(val);
      if (kobo != null) out[id] = kobo;
    }
    return out;
  }

  async function save() {
    // Preserve any non-pricing keys already on the config (e.g. currency).
    const base =
      r.config && typeof r.config === 'object' && !Array.isArray(r.config)
        ? (r.config as Record<string, unknown>)
        : {};
    const config: Record<string, unknown> = {
      ...base,
      currency: 'NGN',
      amount: koboFromNaira(amount),
      classPrices: collectMap(classPrices),
      sectionPrices: collectMap(sectionPrices),
    };
    await onSave({ config });
  }

  const defaultKobo = koboFromNaira(amount);

  return (
    <div className="mt-3 rounded-md border border-dashed border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Banknote className="size-4 text-muted-foreground" aria-hidden />
          Fee pricing
        </div>
        <span className="text-xs text-muted-foreground">
          Default: {defaultKobo != null ? formatNaira(defaultKobo) : 'no fee'}
        </span>
      </div>

      {canManage ? (
        <div className="mt-3 flex flex-col gap-3">
          <div className="flex max-w-xs flex-col gap-1">
            <Label className="text-xs">Default amount (₦)</Label>
            <Input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              placeholder="e.g. 5000 — leave blank for no fee"
              className="h-8"
            />
            <p className="text-[11px] text-muted-foreground">
              Blank or 0 means this fee doesn&apos;t apply (auto-skipped, never
              blocks admission).
            </p>
          </div>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="w-fit text-xs font-medium text-primary hover:underline"
          >
            {open ? 'Hide' : 'Set'} per-class / per-section overrides
          </button>

          {open && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Per class (wins over section)
                </span>
                {yearLevels.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No classes configured.
                  </p>
                ) : (
                  yearLevels.map((y) => (
                    <PriceRow
                      key={y.id}
                      label={y.name}
                      value={classPrices[y.id] ?? ''}
                      onChange={(v) =>
                        setClassPrices((p) => ({ ...p, [y.id]: v }))
                      }
                    />
                  ))
                )}
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Per section
                </span>
                {sections.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No sections available.
                  </p>
                ) : (
                  sections.map((s) => (
                    <PriceRow
                      key={s.id}
                      label={s.displayLabel}
                      value={sectionPrices[s.id] ?? ''}
                      onChange={(v) =>
                        setSectionPrices((p) => ({ ...p, [s.id]: v }))
                      }
                    />
                  ))
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <Button size="sm" disabled={busy} onClick={() => void save()}>
              Save pricing
            </Button>
          </div>
        </div>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">
          {defaultKobo != null
            ? `Default ${formatNaira(defaultKobo)}, with per-class overrides where set.`
            : 'No fee configured.'}
        </p>
      )}
    </div>
  );
}

function PriceRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="min-w-0 flex-1 truncate text-sm">{label}</span>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode="decimal"
        placeholder="₦ default"
        className="h-8 w-28"
      />
    </div>
  );
}

function AddRequirement({
  busy,
  onCancel,
  onSubmit,
}: {
  busy: boolean;
  onCancel: () => void;
  onSubmit: (body: Record<string, unknown>) => void;
}) {
  const [label, setLabel] = React.useState('');
  const [key, setKey] = React.useState('');
  const [type, setType] =
    React.useState<RequirementTemplateRow['type']>('document');
  const [collectStage, setCollectStage] =
    React.useState<RequirementTemplateRow['collectStage']>('application');
  const [required, setRequired] = React.useState(true);

  const slug = key.trim() || label.trim().toLowerCase().replace(/\s+/g, '_');

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/40 p-4">
      <h3 className="text-sm font-semibold">New requirement</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Label</Label>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Development levy"
            className="h-8"
            autoFocus
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Key (stable id)</Label>
          <Input
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder={slug || 'auto from label'}
            className="h-8"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Type</Label>
          <select
            value={type}
            onChange={(e) =>
              setType(e.target.value as RequirementTemplateRow['type'])
            }
            className="h-8 rounded-md border border-input bg-transparent px-2 text-sm capitalize"
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Collected at</Label>
          <select
            value={collectStage}
            onChange={(e) =>
              setCollectStage(
                e.target.value as RequirementTemplateRow['collectStage'],
              )
            }
            className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
          >
            {STAGES.map((s) => (
              <option key={s} value={s}>
                {STAGE_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={required}
          onCheckedChange={(v) => setRequired(v === true)}
        />
        Required
      </label>
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
        <Button
          size="sm"
          disabled={busy || !label.trim() || !slug}
          onClick={() =>
            onSubmit({
              key: slug,
              label: label.trim(),
              type,
              collectStage,
              required,
            })
          }
        >
          Add requirement
        </Button>
      </div>
    </div>
  );
}
