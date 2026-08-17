'use client';

/**
 * WB3-5 · Admission requirements editor — a master–detail view (matching the
 * Application-form authoring tab): the per-tenant checklist (documents /
 * measurements / fees) collected across the admissions journey, grouped by stage
 * in the left rail, with the selected requirement edited in the right pane. Fee
 * rows carry pricing (a default plus optional per-class and per-section overrides)
 * which the applicant detail page resolves and bills. All writes hit the
 * `/api/admissions/requirements*` proxy; `admissions.criteria` is enforced
 * server-side.
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
import { cn } from '@workspace/ui/lib/utils';

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
const STAGE_ORDER: Record<string, number> = {
  application: 0,
  offer: 1,
  acceptance: 2,
  enrolment: 3,
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
  const [dirty, setDirty] = React.useState(false);
  const [mode, setMode] = React.useState<'view' | 'add'>('view');

  const sorted = React.useMemo(
    () =>
      [...requirements].sort(
        (a, b) =>
          (STAGE_ORDER[a.collectStage] ?? 9) -
            (STAGE_ORDER[b.collectStage] ?? 9) ||
          a.order - b.order ||
          a.label.localeCompare(b.label),
      ),
    [requirements],
  );
  const [selectedId, setSelectedId] = React.useState<string | null>(
    () => sorted[0]?.id ?? null,
  );
  const selected = requirements.find((r) => r.id === selectedId) ?? null;

  const grouped = React.useMemo(() => {
    const by: Record<string, RequirementTemplateRow[]> = {};
    for (const r of sorted) (by[r.collectStage] ??= []).push(r);
    return by;
  }, [sorted]);
  const stages = STAGES.filter((s) => grouped[s]?.length);

  function guardDirty(): boolean {
    return !dirty || window.confirm('Discard unsaved changes?');
  }
  function selectRequirement(id: string) {
    if (id === selectedId && mode === 'view') return;
    if (!guardDirty()) return;
    setDirty(false);
    setMode('view');
    setSelectedId(id);
  }
  function startAdd() {
    if (!guardDirty()) return;
    setDirty(false);
    setMode('add');
  }

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

  async function addRequirement(body: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch('/api/admissions/requirements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        toast.error(text?.slice(0, 200) || 'Could not add the requirement');
        return;
      }
      const created = (await res.json()) as RequirementTemplateRow;
      toast.success('Requirement added');
      setDirty(false);
      setMode('view');
      if (created?.id) setSelectedId(created.id);
      router.refresh();
    } catch {
      toast.error('Network error — please try again.');
    } finally {
      setBusy(false);
    }
  }

  const description = (
    <p className="max-w-3xl text-sm text-muted-foreground">
      Documents, measurements and fees the school collects across the admissions
      journey. Fee prices are set here (a default, with optional per-class and
      per-section overrides) and billed automatically from the applicant&rsquo;s
      class.
    </p>
  );

  const empty = requirements.length === 0;

  const body = (
    <>
      {embedded ? (
        description
      ) : (
        <PageHeader
          title="Admission requirements"
          description="Configure what the school collects across the admissions journey — documents, measurements and fees. Fee prices are set here (a default, with optional per-class and per-section overrides) and billed automatically from the applicant's class."
        />
      )}

      {empty && mode === 'view' ? (
        <EmptyState
          title="No requirements yet"
          description={
            canManage
              ? 'Seed the standard Nigerian checklist to get started, or add your own.'
              : 'An administrator has not configured the admission requirements yet.'
          }
          primaryAction={
            canManage
              ? { label: 'Add requirement', onClick: startAdd }
              : undefined
          }
          secondaryAction={
            canManage
              ? {
                  label: 'Seed standard checklist',
                  variant: 'outline',
                  onClick: () =>
                    void send(
                      'POST',
                      'requirements/ensure-defaults',
                      undefined,
                      'Seeded the standard checklist',
                    ),
                }
              : undefined
          }
        />
      ) : (
        <div className="grid min-h-0 gap-4 @4xl/main:min-h-[34rem] @4xl/main:grid-cols-[minmax(15rem,20rem)_1fr]">
          {/* ---- requirement list ---- */}
          <section
            aria-label="Requirements"
            className="flex min-h-0 flex-col gap-3 rounded-xl border border-border bg-card p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">Requirements</h3>
              <span className="text-xs text-muted-foreground">
                {requirements.length}
              </span>
            </div>

            {canManage && (
              <Button
                size="sm"
                variant={mode === 'add' ? 'default' : 'outline'}
                className="w-full"
                disabled={busy}
                onClick={startAdd}
              >
                <Plus className="mr-1 size-4" aria-hidden /> Add requirement
              </Button>
            )}

            <div
              className="flex min-h-0 flex-col gap-3 overflow-y-auto"
              role="list"
            >
              {stages.map((stage) => (
                <div key={stage} className="flex flex-col gap-1">
                  <span className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {STAGE_LABEL[stage] ?? stage}
                  </span>
                  {grouped[stage]!.map((r) => {
                    const active = mode === 'view' && r.id === selected?.id;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => selectRequirement(r.id)}
                        className={cn(
                          'w-full rounded-md border px-3 py-2 text-left transition-colors',
                          active
                            ? 'border-primary bg-primary/5'
                            : 'border-transparent hover:bg-muted',
                        )}
                      >
                        <span className="flex items-center gap-1.5 text-sm">
                          <span className="min-w-0 truncate font-medium">
                            {r.label}
                          </span>
                          {r.required && (
                            <span className="text-destructive">*</span>
                          )}
                        </span>
                        <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] capitalize text-muted-foreground">
                          {r.type === 'fee' && (
                            <Banknote className="size-3.5" aria-hidden />
                          )}
                          {r.type}
                          {!r.active && (
                            <StatusBadge tone="neutral">disabled</StatusBadge>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </section>

          {/* ---- detail / editor ---- */}
          <section
            aria-label="Requirement detail"
            className="flex min-h-0 flex-col gap-4 rounded-xl border border-border bg-card p-4"
          >
            {mode === 'add' && canManage ? (
              <AddRequirement
                busy={busy}
                onDirty={setDirty}
                onCancel={() => {
                  setDirty(false);
                  setMode('view');
                }}
                onSubmit={(payload) => void addRequirement(payload)}
              />
            ) : selected ? (
              <RequirementDetail
                key={selected.id}
                requirement={selected}
                yearLevels={yearLevels}
                sections={sections}
                canManage={canManage}
                busy={busy}
                onDirty={setDirty}
                onSave={(patch) =>
                  send('PATCH', `requirements/${selected.id}`, patch, 'Saved')
                }
              />
            ) : (
              <EmptyState
                compact
                title="Select a requirement"
                description="Choose a requirement to view or edit its details."
              />
            )}
          </section>
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

// -------------------------------------------------------- requirement detail

function RequirementDetail({
  requirement: r,
  yearLevels,
  sections,
  canManage,
  busy,
  onDirty,
  onSave,
}: {
  requirement: RequirementTemplateRow;
  yearLevels: { id: string; name: string }[];
  sections: { id: string; displayLabel: string }[];
  canManage: boolean;
  busy: boolean;
  onDirty: (dirty: boolean) => void;
  onSave: (body: Record<string, unknown>) => Promise<boolean>;
}) {
  const isFee = r.type === 'fee';
  const initialFee = React.useMemo(() => readFeeConfig(r.config), [r.config]);

  const [label, setLabel] = React.useState(r.label);
  const [collectStage, setCollectStage] = React.useState(r.collectStage);
  const [required, setRequired] = React.useState(r.required);
  const [active, setActive] = React.useState(r.active);
  const [amount, setAmount] = React.useState(nairaValue(initialFee.amount));
  const [classPrices, setClassPrices] = React.useState<Record<string, string>>(
    () =>
      Object.fromEntries(
        yearLevels.map((y) => [
          y.id,
          nairaValue(initialFee.classPrices?.[y.id]),
        ]),
      ),
  );
  const [sectionPrices, setSectionPrices] = React.useState<
    Record<string, string>
  >(() =>
    Object.fromEntries(
      sections.map((s) => [s.id, nairaValue(initialFee.sectionPrices?.[s.id])]),
    ),
  );
  const [overridesOpen, setOverridesOpen] = React.useState(false);

  const mark = () => onDirty(true);

  function collectMap(prices: Record<string, string>): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [id, val] of Object.entries(prices)) {
      const kobo = koboFromNaira(val);
      if (kobo != null) out[id] = kobo;
    }
    return out;
  }

  async function save() {
    const body: Record<string, unknown> = {
      label: label.trim(),
      collectStage,
      required,
      active,
    };
    if (isFee) {
      const base =
        r.config && typeof r.config === 'object' && !Array.isArray(r.config)
          ? (r.config as Record<string, unknown>)
          : {};
      body.config = {
        ...base,
        currency: 'NGN',
        amount: koboFromNaira(amount),
        classPrices: collectMap(classPrices),
        sectionPrices: collectMap(sectionPrices),
      };
    }
    const ok = await onSave(body);
    if (ok) onDirty(false);
  }

  const defaultKobo = koboFromNaira(amount);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <span className="min-w-0 truncate">{r.label}</span>
            {r.required && <span className="text-destructive">*</span>}
          </h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs capitalize text-muted-foreground">
            <StatusBadge tone={isFee ? 'blue' : 'neutral'}>
              {r.type}
            </StatusBadge>
            {STAGE_LABEL[r.collectStage] ?? r.collectStage}
            {!r.active && <StatusBadge tone="neutral">disabled</StatusBadge>}
          </div>
        </div>
        {canManage && (
          <Button
            size="sm"
            disabled={busy || !label.trim()}
            onClick={() => void save()}
          >
            Save
          </Button>
        )}
      </div>

      <div className="flex min-h-0 flex-col gap-4 overflow-y-auto border-t border-border pt-4">
        {canManage ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Label</Label>
                <Input
                  value={label}
                  onChange={(e) => {
                    setLabel(e.target.value);
                    mark();
                  }}
                  className="h-9"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Collected at</Label>
                <select
                  value={collectStage}
                  onChange={(e) => {
                    setCollectStage(
                      e.target.value as RequirementTemplateRow['collectStage'],
                    );
                    mark();
                  }}
                  className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
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
                  onCheckedChange={(v) => {
                    setRequired(v === true);
                    mark();
                  }}
                />
                Required
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={active}
                  onCheckedChange={(v) => {
                    setActive(v === true);
                    mark();
                  }}
                />
                Active
              </label>
            </div>
          </>
        ) : (
          <dl className="grid grid-cols-[8rem_1fr] gap-y-2 text-sm">
            <dt className="text-muted-foreground">Collected at</dt>
            <dd>{STAGE_LABEL[r.collectStage] ?? r.collectStage}</dd>
            <dt className="text-muted-foreground">Required</dt>
            <dd>{r.required ? 'Yes' : 'No'}</dd>
            <dt className="text-muted-foreground">Status</dt>
            <dd>{r.active ? 'Active' : 'Disabled'}</dd>
          </dl>
        )}

        {isFee && (
          <div className="rounded-md border border-dashed border-border p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Banknote
                  className="size-4 text-muted-foreground"
                  aria-hidden
                />
                Fee pricing
              </div>
              <span className="text-xs text-muted-foreground">
                Default:{' '}
                {defaultKobo != null ? formatNaira(defaultKobo) : 'no fee'}
              </span>
            </div>

            {canManage ? (
              <div className="mt-3 flex flex-col gap-3">
                <div className="flex max-w-xs flex-col gap-1.5">
                  <Label className="text-xs">Default amount (₦)</Label>
                  <Input
                    value={amount}
                    onChange={(e) => {
                      setAmount(e.target.value);
                      mark();
                    }}
                    inputMode="decimal"
                    placeholder="e.g. 5000 — leave blank for no fee"
                    className="h-9"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Blank or 0 means this fee doesn&apos;t apply (auto-skipped,
                    never blocks admission).
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setOverridesOpen((v) => !v)}
                  className="w-fit text-xs font-medium text-primary hover:underline"
                >
                  {overridesOpen ? 'Hide' : 'Set'} per-class / per-section
                  overrides
                </button>

                {overridesOpen && (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="flex flex-col gap-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
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
                            onChange={(v) => {
                              setClassPrices((p) => ({ ...p, [y.id]: v }));
                              mark();
                            }}
                          />
                        ))
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
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
                            onChange={(v) => {
                              setSectionPrices((p) => ({ ...p, [s.id]: v }));
                              mark();
                            }}
                          />
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">
                {defaultKobo != null
                  ? `Default ${formatNaira(defaultKobo)}, with per-class overrides where set.`
                  : 'No fee configured.'}
              </p>
            )}
          </div>
        )}
      </div>
    </>
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

// --------------------------------------------------------- add a requirement

function AddRequirement({
  busy,
  onDirty,
  onCancel,
  onSubmit,
}: {
  busy: boolean;
  onDirty: (dirty: boolean) => void;
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
  const mark = () => onDirty(true);

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold">New requirement</h3>
        <div className="flex gap-2">
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

      <div className="flex flex-col gap-3 border-t border-border pt-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Label</Label>
            <Input
              value={label}
              onChange={(e) => {
                setLabel(e.target.value);
                mark();
              }}
              placeholder="e.g. Development levy"
              className="h-9"
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Key (stable id)</Label>
            <Input
              value={key}
              onChange={(e) => {
                setKey(e.target.value);
                mark();
              }}
              placeholder={slug || 'auto from label'}
              className="h-9"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Type</Label>
            <select
              value={type}
              onChange={(e) => {
                setType(e.target.value as RequirementTemplateRow['type']);
                mark();
              }}
              className="h-9 rounded-md border border-input bg-transparent px-2 text-sm capitalize"
            >
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Collected at</Label>
            <select
              value={collectStage}
              onChange={(e) => {
                setCollectStage(
                  e.target.value as RequirementTemplateRow['collectStage'],
                );
                mark();
              }}
              className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
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
            onCheckedChange={(v) => {
              setRequired(v === true);
              mark();
            }}
          />
          Required
        </label>
      </div>
    </>
  );
}
